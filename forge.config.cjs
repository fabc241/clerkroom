'use strict'

const QvacForgePlugin = require('@qvac/sdk/electron-forge')

module.exports = {
  packagerConfig: {
    name: 'Clerkroom',
    executableName: 'Clerkroom',
    appBundleId: 'org.clerkroom.app',
    appCategoryType: 'public.app-category.education',
    // build/icon.icns is generated from build/icon.svg (the header mark on a macOS tile).
    icon: 'build/icon',
    // Shown by macOS the first time optional voice input asks for the microphone.
    extendInfo: {
      NSMicrophoneUsageDescription:
        'Clerkroom uses the microphone only when you turn on voice input and press the microphone button. Speech is transcribed on this Mac and the audio is not stored.'
    },
    // Only ship the build output, bundled stations and runtime deps.
    ignore: [/^\/src/, /^\/tests/, /^\/scripts/, /^\/out/, /^\/video/, /^\/build/, /\.md$/, /^\/tsconfig/]
  },
  rebuildConfig: {},
  makers: [
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: { format: 'ULFO' } }
  ],
  plugins: [new QvacForgePlugin({ logLevel: 'info' })]
}
