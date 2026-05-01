const fs = require("fs");
const path = require("path");
const { IOSConfig, withDangerousMod, withXcodeProject } = require("expo/config-plugins");

const SWIFT_FILE_NAME = "SpeakerRouteModule.swift";

const SWIFT_MODULE = `import AVFoundation
import Foundation

@objc(SpeakerRouteModule)
class SpeakerRouteModule: NSObject, RCTBridgeModule {
  @objc
  static func moduleName() -> String! {
    return "SpeakerRouteModule"
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(forceSpeaker:rejecter:)
  func forceSpeaker(resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      try AVAudioSession.sharedInstance().overrideOutputAudioPort(.speaker)
      resolve(true)
    } catch {
      reject("speaker_route_failed", error.localizedDescription, error)
    }
  }

  @objc(clearSpeakerOverride:rejecter:)
  func clearSpeakerOverride(resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      try AVAudioSession.sharedInstance().overrideOutputAudioPort(.none)
      resolve(true)
    } catch {
      reject("speaker_route_clear_failed", error.localizedDescription, error)
    }
  }
}
`;

const BRIDGING_HEADER_IMPORT = "#import <React/RCTBridgeModule.h>";

function withSpeakerRoute(config) {
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const iosRoot = config.modRequest.platformProjectRoot;
      const projectName = config.modRequest.projectName;
      const appRoot = path.join(iosRoot, projectName);
      const swiftFilePath = path.join(appRoot, SWIFT_FILE_NAME);
      const bridgingHeaderPath = path.join(appRoot, `${projectName}-Bridging-Header.h`);

      fs.mkdirSync(appRoot, { recursive: true });
      fs.writeFileSync(swiftFilePath, SWIFT_MODULE);

      const existingHeader = fs.existsSync(bridgingHeaderPath)
        ? fs.readFileSync(bridgingHeaderPath, "utf8")
        : "";

      if (!existingHeader.includes(BRIDGING_HEADER_IMPORT)) {
        const nextHeader = existingHeader.trim()
          ? `${existingHeader.trim()}\n${BRIDGING_HEADER_IMPORT}\n`
          : `${BRIDGING_HEADER_IMPORT}\n`;
        fs.writeFileSync(bridgingHeaderPath, nextHeader);
      }

      return config;
    },
  ]);

  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName;
    const target = IOSConfig.XcodeUtils.getApplicationNativeTarget({
      project,
      projectName,
    }).uuid;

    if (!project.hasFile(SWIFT_FILE_NAME)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: SWIFT_FILE_NAME,
        groupName: projectName,
        project,
        targetUuid: target,
      });
    }

    return config;
  });
}

module.exports = withSpeakerRoute;
