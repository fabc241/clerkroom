'use strict'

const QvacForgePlugin = require('@qvac/sdk/electron-forge')

module.exports = {
  packagerConfig: {
    name: 'DigiPat',
    executableName: 'DigiPat',
    appBundleId: 'org.digipat.app',
    appCategoryType: 'public.app-category.education',
    // Shown by macOS the first time optional voice input asks for the microphone.
    extendInfo: {
      NSMicrophoneUsageDescription:
        'DigiPat uses the microphone only when you turn on voice input and press the microphone button. Speech is transcribed on this Mac and the audio is not stored.'
    },
    // Only ship the build output, bundled stations and runtime deps.
    ignore: [/^\/src/, /^\/tests/, /^\/scripts/, /^\/out/, /\.md$/, /^\/tsconfig/]
  },
  rebuildConfig: {},
  makers: [
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: { format: 'ULFO' } }
  ],
  plugins: [new QvacForgePlugin({ logLevel: 'info' })]
}
