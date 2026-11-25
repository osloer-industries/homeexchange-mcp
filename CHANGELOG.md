# Changelog

All notable changes to homeexchange-mcp are documented here.

## [0.2.0](https://github.com/osloer-industries/homeexchange-mcp/compare/v0.1.7...v0.2.0) (2026-11-24)


### Features

* **lint:** complete type escape-hatch hardening ([#120](https://github.com/osloer-industries/homeexchange-mcp/issues/120)) ([a27f6b7](https://github.com/osloer-industries/homeexchange-mcp/commit/a27f6b7e892e463726fc151edd0a0df2ece0fe5f))


### Bug Fixes

* **deps:** clear undici and js-yaml Dependabot alerts via parent bumps ([#123](https://github.com/osloer-industries/homeexchange-mcp/issues/123)) ([f91e3fe](https://github.com/osloer-industries/homeexchange-mcp/commit/f91e3febef1890355b7e10971354cb4b48bdbdb2))

## [0.1.7](https://github.com/osloer-industries/homeexchange-mcp/compare/v0.1.6...v0.1.7) (2026-11-20)


### Bug Fixes

* **deps:** resolve minimatch DoS advisory via eslint and typescript-eslint bumps ([#117](https://github.com/osloer-industries/homeexchange-mcp/issues/117)) ([2df2f32](https://github.com/osloer-industries/homeexchange-mcp/commit/2df2f32158fba8915808029ae3a901297b3a7620))

## [0.1.6](https://github.com/osloer-industries/homeexchange-mcp/compare/v0.1.5...v0.1.6) (2026-11-17)


### Bug Fixes

* clear SonarCloud smells and dedupe search tools ([#97](https://github.com/osloer-industries/homeexchange-mcp/issues/97)) ([5c71f4a](https://github.com/osloer-industries/homeexchange-mcp/commit/5c71f4a83940a8da58fa9a0156aa7f81cf96016d))

## [0.1.5](https://github.com/osloer-industries/homeexchange-mcp/compare/v0.1.4...v0.1.5) (2026-11-16)


### Documentation

* align AGENTS.md with org-wide agent workflow ([#100](https://github.com/osloer-industries/homeexchange-mcp/issues/100)) ([fdf4548](https://github.com/osloer-industries/homeexchange-mcp/commit/fdf4548a53c2301541747b7bd8b15b9e26d3c2ac))

## [0.1.4](https://github.com/osloer-industries/homeexchange-mcp/compare/v0.1.3...v0.1.4) (2026-11-15)


### Bug Fixes

* **deps:** patch hono stack blocked by npm overrides ([3d1e3dc](https://github.com/osloer-industries/homeexchange-mcp/commit/3d1e3dc2b9118f915161fc89982df80ad0e805d2))

## [0.1.3](https://github.com/osloer-industries/homeexchange-mcp/compare/v0.1.2...v0.1.3) (2026-11-12)


### Bug Fixes

* **record:** write session only to canonical path for CodeQL ([08e38c0](https://github.com/osloer-industries/homeexchange-mcp/commit/08e38c0c4a0593b01d18e0f833a76d251fd2fe9f))
* resolve Sonar bugs and trim duplicated URL helpers ([a9d0f95](https://github.com/osloer-industries/homeexchange-mcp/commit/a9d0f952214b1dcfff83d7d36a2b4b12312362e0))

## [0.1.2](https://github.com/osloer-industries/homeexchange-mcp/compare/v0.1.1...v0.1.2) (2026-11-04)


### Bug Fixes

* **api:** raise SessionExpiredError on 401 ([#77](https://github.com/osloer-industries/homeexchange-mcp/issues/77)) ([1a06d5a](https://github.com/osloer-industries/homeexchange-mcp/commit/1a06d5a00728fbcf91d37dc695a30da0300b3433))
* **deps:** resolve Dependabot security pins for mocker, fast-uri, ip-address ([#84](https://github.com/osloer-industries/homeexchange-mcp/issues/84)) ([ec22dde](https://github.com/osloer-industries/homeexchange-mcp/commit/ec22ddec31f1363fefdf7f3aef19d788ebd4afbd))

## [0.1.1](https://github.com/osloer-industries/homeexchange-mcp/compare/v0.1.0...v0.1.1) (2026-08-29)


### Bug Fixes

* **search:** align BFF request format safely ([#64](https://github.com/osloer-industries/homeexchange-mcp/issues/64)) ([9aa906c](https://github.com/osloer-industries/homeexchange-mcp/commit/9aa906ce4bfeb45f7487664444e8b275b9b0af78))

Thanks to [@joelgombin](https://github.com/joelgombin) for the community
investigation of the search API request format and geo-filtering that informed
this safe implementation.

## [0.1.0](https://github.com/osloer-industries/homeexchange-mcp/compare/v0.0.1...v0.1.0) (2026-08-24)


### Features

* add messaging and user tools, contributed by [@courentin](https://github.com/courentin) ([d6a8c1c](https://github.com/osloer-industries/homeexchange-mcp/commit/d6a8c1c0cda90659fafa6c2d1870a3e609915fb2))


### Bug Fixes

* harden dependencies and CI ([#36](https://github.com/osloer-industries/homeexchange-mcp/issues/36)) ([1d2ccf0](https://github.com/osloer-industries/homeexchange-mcp/commit/1d2ccf0ff09d34484f8c5c5fc64d91f4b6ac24ee))
* reliably save local HomeExchange sessions ([#58](https://github.com/osloer-industries/homeexchange-mcp/issues/58)) ([8036312](https://github.com/osloer-industries/homeexchange-mcp/commit/8036312f2950c70622e8978b71f0caaf429e7b4a))
* satisfy quality gate for new tools ([#51](https://github.com/osloer-industries/homeexchange-mcp/issues/51)) ([af520b1](https://github.com/osloer-industries/homeexchange-mcp/commit/af520b16dfc2e92ae5a82e16cb3cb61b3e0df86d))


### Documentation

* convert roadmap to issues, add Contributing section, add SonarCloud badge ([7f6c72a](https://github.com/osloer-industries/homeexchange-mcp/commit/7f6c72a1415a82ddec4ca3e31648a3dc4eb107b8))
* rebrand README with HomeExchange aesthetic, lead with capabilities ([a26f286](https://github.com/osloer-industries/homeexchange-mcp/commit/a26f2861f33f79bce387204b174aca1e4dee37d7))

## [0.0.1](https://github.com/tn819/homeexchange-mcp/compare/v0.0.0...v0.0.1) (2026-03-10)

### Bug Fixes

* **ci:** bump Node.js to 22 for semantic-release@25 compatibility ([2e110ec](https://github.com/tn819/homeexchange-mcp/commit/2e110ec93ce17d55cf5859a1fca9f752e3d7349e))
* **ci:** disable npm publish, GitHub release only ([4e6ae65](https://github.com/tn819/homeexchange-mcp/commit/4e6ae650361574549a2e2e09d54089cef856f7cb))
* **ci:** re-trigger release from v0.0.0 anchor ([d6676cd](https://github.com/tn819/homeexchange-mcp/commit/d6676cd22db3fb55f2bd2574dd58c7035a056787))

### Documentation

* add disclaimer, license, and full client setup guide ([6488b26](https://github.com/tn819/homeexchange-mcp/commit/6488b26b51eea39074029a1c1e04c4ff4199f7f0))
* make MCP setup client-agnostic, expand tool parameter reference ([209e573](https://github.com/tn819/homeexchange-mcp/commit/209e57331bbb3dce32a197040e481756c99c00e4))

## 1.0.0 (2026-03-10)

### Features

* initial HomeExchange MCP server ([1cb30cd](https://github.com/tn819/homeexchange-mcp/commit/1cb30cd80b8b91b85ac1d7659818bfa12f9efe98))

### Bug Fixes

* **ci:** bump Node.js to 22 for semantic-release@25 compatibility ([2e110ec](https://github.com/tn819/homeexchange-mcp/commit/2e110ec93ce17d55cf5859a1fca9f752e3d7349e))
* **ci:** disable npm publish, GitHub release only ([4e6ae65](https://github.com/tn819/homeexchange-mcp/commit/4e6ae650361574549a2e2e09d54089cef856f7cb))

### Documentation

* add disclaimer, license, and full client setup guide ([6488b26](https://github.com/tn819/homeexchange-mcp/commit/6488b26b51eea39074029a1c1e04c4ff4199f7f0))
* make MCP setup client-agnostic, expand tool parameter reference ([209e573](https://github.com/tn819/homeexchange-mcp/commit/209e57331bbb3dce32a197040e481756c99c00e4))
