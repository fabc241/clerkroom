'use strict'

const QvacForgePlugin = require('@qvac/sdk/electron-forge')

module.exports = {
  packagerConfig: {
    name: 'DigiPat',
    executableName: 'digipat',
    appBundleId: 'org.digipat.app',
    appCategoryType: 'public.app-category.education',
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
