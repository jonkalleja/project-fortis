'use strict';

const Promise = require('promise');
const uuid = require('uuid/v4');
const cassandraConnector = require('../../clients/cassandra/CassandraConnector');
const blobStorageClient = require('../../clients/storage/BlobStorageClient');
const streamingController = require('../../clients/streaming/StreamingController');
const { withRunTime, limitForInClause, requiresRole } = require('../shared');
const { trackEvent, trackException } = require('../../clients/appinsights/AppInsightsClient');
const loggingClient = require('../../clients/appinsights/LoggingClient');

const {
  fortisCentralAssetsHost
} = require('../../../config').storage;

function _insertTopics(siteType) {
  return new Promise((resolve, reject) => {
    if (!siteType || !siteType.length) return reject('insertTopics: siteType is not defined');

    const uri = `${fortisCentralAssetsHost}/settings/siteTypes/${siteType}/topics/defaultTopics.json`;
    let mutations = [];
    blobStorageClient.fetchJson(uri)
      .then(response => {
        return response.map(topic => ({
          query: `INSERT INTO fortis.watchlist (topicid,topic,lang_code,translations,insertiontime,category)
                VALUES (?, ?, ?, ?, toTimestamp(now()), ?);`,
          params: [uuid(), topic.topic, topic.lang_code, topic.translations, topic.category || '']
        }));
      })
      .then(response => {
        mutations = response;
        return cassandraConnector.executeBatchMutations(response);
      })
      .then(() => {
        streamingController.notifyWatchlistUpdate();
      })
      .then(() => {
        resolve({
          numTopicsInserted: mutations.length
        });
      })
      .catch(reject);
  });
}

const insertTopics = trackEvent(_insertTopics, 'Settings.Topics.Insert', (response, err) => ({numTopicsInserted: err ? 0 : response.numTopicsInserted}));

function editSite(args, res) { // eslint-disable-line no-unused-vars
  return new Promise((resolve, reject) => {
    const siteName = args && args.input && args.input.name;
    if (!siteName || !siteName.length) return reject('sitename is not defined');

    cassandraConnector.executeQuery('SELECT * FROM fortis.sitesettings WHERE sitename = ?;', [siteName])
      .then(rows => {
        if (rows.length !== 1) return reject(`Site with sitename ${siteName} does not exist.`);
      })
      .then(() => {
        return cassandraConnector.executeBatchMutations([{
          query: `UPDATE fortis.sitesettings
          SET geofence = ?,
          defaultzoom = ?,
          logo = ?,
          title = ?,
          languages = ?,
          defaultlanguage = ?,
          cogspeechsvctoken = ?,
          cogtextsvctoken = ?,
          cogvisionsvctoken = ?,
          featureservicenamespace = ?,
          translationsvctoken = ?
        WHERE sitename = ?`,
          params: [
            args.input.targetBbox,
            args.input.defaultZoomLevel,
            args.input.logo,
            args.input.title,
            args.input.supportedLanguages,
            args.input.defaultLanguage,
            args.input.cogSpeechSvcToken,
            args.input.cogTextSvcToken,
            args.input.cogVisionSvcToken,
            args.input.featureservicenamespace,
            args.input.translationSvcToken,
            args.input.name
          ]
        }]);
      })
      .then(() => {
        streamingController.notifySiteSettingsUpdate();
      })
      .then(() => {
        resolve({
          name: args.input.name,
          properties: {
            targetBbox: args.input.targetBbox,
            defaultZoomLevel: args.input.defaultZoomLevel,
            logo: args.input.logo,
            title: args.input.title,
            defaultLocation: args.input.defaultLocation,
            supportedLanguages:args.input.supportedLanguages,
            defaultLanguage: args.input.defaultLanguage,
            cogSpeechSvcToken: args.input.cogSpeechSvcToken,
            cogTextSvcToken: args.input.cogTextSvcToken,
            cogVisionSvcToken: args.input.cogVisionSvcToken,
            featureservicenamespace: args.input.featureservicenamespace,
            translationSvcToken: args.input.translationSvcToken
          }
        });
      })
      .catch(reject);
  });
}

function createSite(args, res) { // eslint-disable-line no-unused-vars
  return new Promise((resolve, reject) => {
    const siteType = args && args.input && args.input.siteType;
    if (!siteType || !siteType.length) return reject(`siteType for sitename ${args.input.name} is not defined`);

    cassandraConnector.executeQuery('SELECT * FROM fortis.sitesettings WHERE sitename = ?;', [args.input.name])
      .then(rows => {
        if (!rows || !rows.length) return insertTopics(siteType);
        else if (rows.length == 1) return reject(`Site with sitename ${args.input.name} already exists.`);
        else return reject(`(${rows.length}) number of sites with sitename ${args.input.name} already exist.`);
      })
      .then(() => {
        return cassandraConnector.executeBatchMutations([{
          query: `INSERT INTO fortis.sitesettings (
          geofence,
          defaultzoom,
          logo,
          title,
          sitename,
          languages,
          insertiontime
        ) VALUES (?,?,?,?,?,?,toTimestamp(now()))`,
          params: [
            args.input.targetBbox,
            args.input.defaultZoomLevel,
            args.input.logo,
            args.input.title,
            args.input.name,
            args.input.supportedLanguages
          ]
        }]);
      })
      .then(() => {
        streamingController.restartStreaming();
      })
      .then(() => {
        resolve({
          name: args.input.name,
          properties: {
            targetBbox: args.input.targetBbox,
            defaultZoomLevel: args.input.defaultZoomLevel,
            logo: args.input.logo,
            title: args.input.title,
            defaultLocation: args.input.defaultLocation,
            supportedLanguages:args.input.supportedLanguages
          }
        });
      })
      .catch(reject);
  });
}

function addTrustedSources(args, res) { // eslint-disable-line no-unused-vars
  return new Promise((resolve, reject) => {
    if (!args || !args.input || !args.input.sources || !args.input.sources.length) {
      loggingClient.logNoTrustedSourcesToAdd();
      return reject('No trustedsources to add specified.');
    }

    let mutations = [];
    args.input.sources.forEach(source => {
      mutations.push({
        query: `INSERT INTO fortis.trustedsources (
          pipelinekey,
          externalsourceid,
          sourcetype,
          rank,
          displayname,
          insertiontime,
          reportingcategory
        ) VALUES (?,?,?,?,?,dateof(now()),?)`,
        params: [
          source.pipelinekey,
          source.externalsourceid,
          source.sourcetype,
          source.rank,
          source.displayname,
          source.reportingcategory
        ]
      });
    });

    cassandraConnector.executeBatchMutations(mutations)
      .then(_ => { // eslint-disable-line no-unused-vars
        resolve({
          sources: args.input.sources
        });
      })
      .catch(error => {
        trackException(error);
        reject(error);
      });
  });
}

function removeTrustedSources(args, res) { // eslint-disable-line no-unused-vars
  return new Promise((resolve, reject) => {
    if (!args || !args.input || !args.input.sources || !args.input.sources.length) {
      loggingClient.logNoTrustedSourcesToRemove();
      return reject('No trusted sources to remove specified.');
    }

    const mutations = args.input.sources.map(source => ({
      query: 'DELETE FROM fortis.trustedsources WHERE pipelinekey = ? AND externalsourceid = ? AND sourcetype = ? AND rank = ?',
      params: [source.pipelinekey, source.externalsourceid, source.sourcetype, source.rank]
    }));

    cassandraConnector.executeBatchMutations(mutations)
      .then(_ => { // eslint-disable-line no-unused-vars
        resolve({
          sources: args.input.sources
        });
      })
      .catch(error => {
        trackException(error);
        reject(error);
      });
  });
}

function removeKeywords(args, res) { // eslint-disable-line no-unused-vars
  return new Promise((resolve, reject) => {
    if (!args || !args.input || !args.input.edges || !args.input.edges.length) {
      loggingClient.logNoKeywordsToRemove();
      return reject('No keywords to remove specified.');
    }

    const mutations = args.input.edges.map(edge => ({
      query: 'DELETE FROM fortis.watchlist WHERE topic = ? AND lang_code = ?',
      params: [edge.name, edge.namelang]
    }));

    cassandraConnector.executeBatchMutations(mutations)
      .then(() => {
        streamingController.notifyWatchlistUpdate();
      })
      .then(_ => { // eslint-disable-line no-unused-vars
        resolve({
          edges: args.input.edges
        });
      })
      .catch(error => {
        trackException(error);
        reject(error);
      });
  });
}

function addKeywords(args, res) { // eslint-disable-line no-unused-vars
  return new Promise((resolve, reject) => {
    if (!args || !args.input || !args.input.edges || !args.input.edges.length) {
      loggingClient.logNoKeywordsToAdd();
      return reject('No keywords to add specified.');
    }

    let mutations = [];
    args.input.edges.forEach(edge => {
      let params = paramEntryToMap(edge.translations);
      mutations.push({
        query: `INSERT INTO fortis.watchlist (
          topic,
          lang_code,
          category,
          insertiontime,
          topicid,
          translations
        ) VALUES (?,?,?,dateof(now()),?,?)`,
        params: [edge.name, edge.namelang, edge.category, edge.topicid, params]
      });
    });

    cassandraConnector.executeBatchMutations(mutations)
      .then(() => {
        streamingController.notifyWatchlistUpdate();
      })
      .then(_ => { // eslint-disable-line no-unused-vars
        resolve({
          edges: args.input.edges
        });
      })
      .catch(error => {
        trackException(error);
        reject(error);
      });
  });
}

function removeSite(args, res) { // eslint-disable-line no-unused-vars
  return new Promise((resolve, reject) => {
    cassandraConnector.executeBatchMutations([{
      query: 'DELETE FROM fortis.sitesettings WHERE sitename = ?;',
      params: [args.input.name]
    }])
      .then(() => {
        resolve({
          name: args.input.name,
          properties: {
            targetBbox: args.input.targetBbox,
            defaultZoomLevel: args.input.defaultZoomLevel,
            logo: args.input.logo,
            title: args.input.title,
            defaultLocation: args.input.defaultLocation,
            supportedLanguages: args.input.supportedLanguages
          }
        });
      })
      .catch(reject);
  });
}

function paramEntryToMap(paramEntry) {
  return paramEntry.reduce((obj, item) => (obj[item.key] = item.value, obj), {});
}

function modifyStreams(args, res) { // eslint-disable-line no-unused-vars
  return new Promise((resolve, reject) => {
    const streams = args && args.input && args.input.streams;
    if (!streams || !streams.length) {
      loggingClient.logNoStreamParamsToEdit();
      return reject('No streams specified');
    }

    const mutations = [];
    streams.forEach(stream => {
      let params = paramEntryToMap(stream.params);
      mutations.push({
        query: `UPDATE fortis.streams
        SET pipelinelabel = ?,
        pipelineicon = ?,
        streamfactory = ?,
        params = ?,
        enabled = ?
        WHERE streamid = ? AND pipelinekey = ?`,
        params: [
          stream.pipelineLabel,
          stream.pipelineIcon,
          stream.streamFactory,
          params,
          stream.enabled,
          stream.streamId,
          stream.pipelineKey
        ]
      });
    });

    cassandraConnector.executeBatchMutations(mutations)
      .then(() => {
        streamingController.restartStreaming();
      })
      .then(() => {
        resolve({
          streams
        });
      })
      .catch(error => {
        trackException(error);
        reject(error);
      });
  });
}

function modifyBlacklist(args, res) { // eslint-disable-line no-unused-vars
  return new Promise((resolve, reject) => {
    const termFilters = args && args.input && args.input.filters;
    if (!termFilters || !termFilters.length) return reject('No blacklists to modify specified.');

    const mutations = [];
    const filterRecords = [];
    termFilters.forEach(termFilter => {
      if (termFilter.id) {
        mutations.push({
          query: 'UPDATE blacklist SET conjunctivefilter = ? WHERE id = ?',
          params: [termFilter.filteredTerms, termFilter.id]
        });
      } else {
        termFilter.id = uuid();
        mutations.push({
          query:'INSERT INTO blacklist (id, conjunctivefilter) VALUES (?, ?)',
          params:[termFilter.id, termFilter.filteredTerms]
        });
      }
      filterRecords.push(termFilter);
    });

    cassandraConnector.executeBatchMutations(mutations)
      .then(() => {
        streamingController.notifyBlacklistUpdate();
      })
      .then(() => resolve({ filters: filterRecords }))
      .catch(reject);
  });
}

function removeBlacklist(args, res) { // eslint-disable-line no-unused-vars
  return new Promise((resolve, reject) => {
    const termFilters = args && args.input && args.input.filters;
    if (!termFilters || !termFilters.length) return reject('No blacklists to remove specified.');

    const termIds = termFilters.map(termFilter => termFilter.id);

    const query = `
    DELETE
    FROM fortis.blacklist
    WHERE id IN ?
    `;

    const params = [
      limitForInClause(termIds)
    ];

    cassandraConnector.executeQuery(query, params)
      .then(() => {
        streamingController.notifyBlacklistUpdate();
      })
      .then(() => {
        resolve({
          filters: termFilters
        });
      })
      .catch(reject);
  });
}

module.exports = {
  createSite: requiresRole(trackEvent(createSite, 'createSite'), 'admin'),
  removeSite: requiresRole(trackEvent(removeSite, 'removeSite'), 'admin'),
  modifyStreams: requiresRole(trackEvent(withRunTime(modifyStreams), 'modifyStreams', loggingClient.modifyStreamsExtraProps(), loggingClient.streamsExtraMetrics()), 'admin'),
  removeKeywords: requiresRole(trackEvent(withRunTime(removeKeywords), 'removeKeywords', loggingClient.removeKeywordsExtraProps(), loggingClient.keywordsExtraMetrics()), 'admin'),
  addKeywords: requiresRole(trackEvent(withRunTime(addKeywords), 'addKeywords', loggingClient.addKeywordsExtraProps(), loggingClient.keywordsExtraMetrics()), 'admin'),
  editSite: requiresRole(trackEvent(withRunTime(editSite), 'editSite'), 'admin'),
  modifyBlacklist: requiresRole(trackEvent(withRunTime(modifyBlacklist), 'modifyBlacklist'), 'admin'),
  removeBlacklist: requiresRole(trackEvent(withRunTime(removeBlacklist), 'removeBlacklist'), 'admin'),
  addTrustedSources: requiresRole(trackEvent(withRunTime(addTrustedSources), 'addTrustedSources', loggingClient.addTrustedSourcesExtraProps(), loggingClient.trustedSourcesExtraMetrics()), 'admin'),
  removeTrustedSources: requiresRole(trackEvent(withRunTime(removeTrustedSources), 'removeTrustedSources', loggingClient.removeTrustedSourcesExtraProps(), loggingClient.trustedSourcesExtraMetrics()), 'admin')
};