const fs = require("fs");
const path = require("path");
const { IOSConfig, withDangerousMod, withXcodeProject } = require("expo/config-plugins");

const MODULE_FILE_NAME = "SpeakerRouteModule.m";
const OLD_SWIFT_FILE_NAME = "SpeakerRouteModule.swift";
const getModuleProjectPath = (projectName) => `${projectName}/${MODULE_FILE_NAME}`;
const getOldSwiftProjectPath = (projectName) => `${projectName}/${OLD_SWIFT_FILE_NAME}`;

const OBJECTIVE_C_MODULE = `#import <AVFoundation/AVFoundation.h>
#import <React/RCTBridgeModule.h>

@interface SpeakerRouteModule : NSObject <RCTBridgeModule>
@end

@implementation SpeakerRouteModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_REMAP_METHOD(forceSpeaker,
                 forceSpeakerWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSError *error = nil;
  BOOL success = [[AVAudioSession sharedInstance] overrideOutputAudioPort:AVAudioSessionPortOverrideSpeaker error:&error];

  if (!success || error != nil) {
    reject(@"speaker_route_failed", error.localizedDescription ?: @"Unable to route audio to speaker", error);
    return;
  }

  resolve(@YES);
}

RCT_REMAP_METHOD(clearSpeakerOverride,
                 clearSpeakerOverrideWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSError *error = nil;
  BOOL success = [[AVAudioSession sharedInstance] overrideOutputAudioPort:AVAudioSessionPortOverrideNone error:&error];

  if (!success || error != nil) {
    reject(@"speaker_route_clear_failed", error.localizedDescription ?: @"Unable to clear speaker route", error);
    return;
  }

  resolve(@YES);
}

@end
`;

function removeProjectReferencesByName(project, fileName, targetUuid) {
  const fileReferenceSection = project.pbxFileReferenceSection();
  const buildFileSection = project.pbxBuildFileSection();
  const removedFileRefs = new Set();
  const removedBuildFiles = new Set();

  for (const [key, value] of Object.entries(fileReferenceSection)) {
    if (key.endsWith("_comment")) continue;
    if (value?.name === fileName || value?.path?.endsWith(fileName)) {
      removedFileRefs.add(key);
      delete fileReferenceSection[key];
      delete fileReferenceSection[`${key}_comment`];
    }
  }

  for (const [key, value] of Object.entries(buildFileSection)) {
    if (key.endsWith("_comment")) continue;
    if (removedFileRefs.has(value?.fileRef) || value?.fileRef_comment === fileName) {
      removedBuildFiles.add(key);
      delete buildFileSection[key];
      delete buildFileSection[`${key}_comment`];
    }
  }

  const sourcesBuildPhase = project.pbxSourcesBuildPhaseObj(targetUuid);
  if (sourcesBuildPhase?.files) {
    sourcesBuildPhase.files = sourcesBuildPhase.files.filter(
      (file) => !removedBuildFiles.has(file.value) && file.comment !== `${fileName} in Sources`,
    );
  }

  const groups = project.hash.project.objects.PBXGroup ?? {};
  for (const group of Object.values(groups)) {
    if (!group?.children) continue;
    group.children = group.children.filter(
      (child) => !removedFileRefs.has(child.value) && child.comment !== fileName,
    );
  }
}

function withSpeakerRoute(config) {
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const iosRoot = config.modRequest.platformProjectRoot;
      const projectName = config.modRequest.projectName;
      const appRoot = path.join(iosRoot, projectName);
      const moduleFilePath = path.join(iosRoot, getModuleProjectPath(projectName));
      const oldSwiftFilePath = path.join(iosRoot, getOldSwiftProjectPath(projectName));

      fs.mkdirSync(appRoot, { recursive: true });
      fs.writeFileSync(moduleFilePath, OBJECTIVE_C_MODULE);

      if (fs.existsSync(oldSwiftFilePath)) {
        fs.rmSync(oldSwiftFilePath);
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

    removeProjectReferencesByName(project, OLD_SWIFT_FILE_NAME, target);

    if (!project.hasFile(MODULE_FILE_NAME)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: getModuleProjectPath(projectName),
        groupName: projectName,
        project,
        targetUuid: target,
      });
    }

    return config;
  });
}

module.exports = withSpeakerRoute;
