'use strict'

const QvacForgePlugin = require('@qvac/sdk/electron-forge')
const { FusesPlugin } = require('@electron-forge/plugin-fuses')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')

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
    // Root dotfiles (.git, .impeccable design tooling, .nvmrc) and build configs stay out too.
    ignore: [
      /^\/src/,
      /^\/tests/,
      /^\/scripts/,
      /^\/out/,
      /^\/video/,
      /^\/build/,
      /\.md$/,
      /^\/tsconfig/,
      /^\/\./,
      /^\/(electron\.vite|vitest)\.config\.ts$/,
      /^\/forge\.config\.cjs$/
    ]
  },
  rebuildConfig: {},
  makers: [
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: { format: 'ULFO' } }
  ],
  plugins: [
    new QvacForgePlugin({ logLevel: 'info' }),
    // Stops the shipped binary being reused as a plain Node runtime (ELECTRON_RUN_AS_NODE,
    // NODE_OPTIONS, --inspect), which would inherit the app's microphone permission. The QVAC
    // worker runs on its own Bare runtime, so it does not need these.
    new FusesPlugin({
      version: FuseVersion.V1,
      resetAdHocDarwinSignature: true,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableCookieEncryption]: true
    })
  ]
}
