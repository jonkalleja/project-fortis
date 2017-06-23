package com.microsoft.partnercatalyst.fortis.spark.serialization

import com.esotericsoftware.kryo.Kryo
import org.apache.spark.serializer.{KryoRegistrator => BaseKryoRegistrator}

class KryoRegistrator extends BaseKryoRegistrator {
  override def registerClasses(kryo: Kryo): Unit = {
    // !!!!!!!!!!!! ATTENTION !!!!!!!!!!!!
    // the order of these registration calls matters as it determines the class ids
    // so always add new classes at the end of this list
    // more information: https://stackoverflow.com/a/32869053/3817588
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.dto.FortisAnalysis])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.transforms.locations.Geofence])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.transforms.locations.PlaceRecognizer])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.transforms.locations.LocationsExtractor])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.transforms.locations.client.FeatureServiceClient])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.transforms.topic.KeywordExtractor])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.transforms.image.ImageAnalyzer])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.transforms.image.ImageAnalysisAuth])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.transforms.language.LanguageDetector])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.transforms.language.LanguageDetectorAuth])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.transforms.sentiment.SentimentDetector])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.transforms.sentiment.CognitiveServicesSentimentDetector])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.transforms.sentiment.WordListSentimentDetector])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.transforms.sentiment.SentimentDetectorAuth])
    kryo.register(classOf[twitter4j.Status])
    kryo.register(classOf[twitter4j.GeoLocation])
    kryo.register(classOf[twitter4j.Place])
    kryo.register(classOf[twitter4j.User])
    kryo.register(classOf[twitter4j.Scopes])
    kryo.register(classOf[facebook4j.Post])
    kryo.register(classOf[facebook4j.Category])
    kryo.register(classOf[facebook4j.Privacy])
    kryo.register(classOf[facebook4j.Place])
    kryo.register(classOf[facebook4j.Comment])
    kryo.register(classOf[facebook4j.Application])
    kryo.register(classOf[facebook4j.Targeting])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.tadaweb.dto.TadawebEvent])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.tadaweb.dto.TadawebCity])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.tadaweb.dto.TadawebTada])
    kryo.register(classOf[com.microsoft.partnercatalyst.fortis.spark.streamwrappers.radio.RadioTranscription])
    kryo.register(classOf[com.github.catalystcode.fortis.spark.streaming.instagram.dto.InstagramItem])
    kryo.register(classOf[com.github.catalystcode.fortis.spark.streaming.instagram.dto.InstagramUser])
    kryo.register(classOf[com.github.catalystcode.fortis.spark.streaming.instagram.dto.InstagramLocation])
    kryo.register(classOf[com.github.catalystcode.fortis.spark.streaming.instagram.dto.InstagramImages])
    kryo.register(classOf[com.github.catalystcode.fortis.spark.streaming.instagram.dto.InstagramImage])
    kryo.register(classOf[com.github.catalystcode.fortis.spark.streaming.instagram.dto.InstagramCaption])
    kryo.register(classOf[com.github.catalystcode.fortis.spark.streaming.instagram.dto.InstagramLikes])
    kryo.register(classOf[com.github.catalystcode.fortis.spark.streaming.instagram.dto.InstagramCaption])
  }
}
