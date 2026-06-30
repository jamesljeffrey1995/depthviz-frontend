# [1.7.0](https://github.com/jamesljeffrey1995/depthviz-frontend/compare/v1.6.0...v1.7.0) (2026-06-30)


### Bug Fixes

* **competition:** treat 0g target-species minimum as "no minimum"; print only the brief ([97815fc](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/97815fcec8b5d2cb718f49c6d52201e01776d926))


### Features

* **competition:** organiser template tab with target species & brief ([d24cda5](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/d24cda506426c6504fa98a4866ad0c4e15bd8ef1))

# [1.6.0](https://github.com/jamesljeffrey1995/depthviz-frontend/compare/v1.5.0...v1.6.0) (2026-06-23)


### Features

* **competition:** registration entry point, day-view, and safety-alert settings ([caea913](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/caea913a6c4e77ab8c2b5044f3e0e23af652f6e1))
* **competition:** separate test buttons for Slack, email, and both ([27d4554](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/27d45548ad56ff9896a89ece1b82409d84fdf724))

# [1.5.0](https://github.com/jamesljeffrey1995/depthviz-frontend/compare/v1.4.1...v1.5.0) (2026-06-22)


### Features

* **competition:** table-driven weigh-in with catch tally and later weighing ([c8d4986](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/c8d498680baea0162961a19d7e105fbdc6f9e403))

## [1.4.1](https://github.com/jamesljeffrey1995/depthviz-frontend/compare/v1.4.0...v1.4.1) (2026-06-22)


### Bug Fixes

* navigate to forecast immediately on search so loading state is visible ([48d8891](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/48d889106e1b05b87b4e12edb57d8202d33427b3))

# [1.4.0](https://github.com/jamesljeffrey1995/depthviz-frontend/compare/v1.3.0...v1.4.0) (2026-06-22)


### Features

* add admin-only competition operations area at /admin/competition ([d105af0](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/d105af00dee833df19685abe549b6d255d7dc2b4))

# [1.3.0](https://github.com/jamesljeffrey1995/depthviz-frontend/compare/v1.2.0...v1.3.0) (2026-06-22)


### Features

* add disputes management tab to AdminPanel ([a71ebdd](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/a71ebddf2795db682038d9337908f758ba83971b))

# [1.2.0](https://github.com/jamesljeffrey1995/depthviz-frontend/compare/v1.1.0...v1.2.0) (2026-06-22)


### Features

* update contact emails to [@depthviz](https://github.com/depthviz).uk ([16cb458](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/16cb4584caf3850d2bdaa3afa8a845a4f80ca105))

# [1.1.0](https://github.com/jamesljeffrey1995/depthviz-frontend/compare/v1.0.0...v1.1.0) (2026-06-22)


### Features

* surface changelog on website at /changelog ([bfc7d5f](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/bfc7d5f6b3c8e6e3a7aa8ba1c73e9414976be68d))

# 1.0.0 (2026-06-22)


### Bug Fixes

* add inline CSP meta tag to index.html so OpenCV.js 'unsafe-eval' is always applied ([a7f1716](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/a7f171632cfb6f3eb68d702f5f605043268df4d2))
* add media-src and worker-src blob: to CSP ([5eeb875](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/5eeb8754bc717ece210a8135b1c8883938c334cb))
* add nginx example config and README docs for self-hosted CSP ([267aefa](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/267aefa7396b7291bd76c021f679cac6f03f4823))
* add WebCodecs fallback for iOS videos that <video> refuses ([34ecc8b](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/34ecc8b4237f9b75f115ff201a87761d36f59752))
* address code review - prevent negative votes, add sync warning, optimize spot counter ([f6bf6fa](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/f6bf6fa55f462eb3465a06c20223ec9d3a11d51a))
* address Copilot review — remove card-level overflow:hidden, add ellipsis to debugRunning ([bc20641](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/bc20641e326a342f549a51011c40822c85b8871c))
* address Copilot review on localStorage cache and startup restore ([0493fe8](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/0493fe830a460fe88bcacb3d6c9e48132afc1681))
* address review feedback - sanitize votes, aria-labels, strict isPublic, downgrade on API failure, creator attribution, soften public copy, clean up stale votes ([eeff441](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/eeff4416b7eccb060c6ec14b46427e2c2f23f05f))
* **admin:** address review on overview dashboard ([e3501da](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/e3501da261a2ad3d949aa1e7f277dabdf08a4e66)), closes [#158](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/158)
* align forecast and admin title text ([ab5f59a](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/ab5f59a660efe99421d86297c8cd64fb3e11a670))
* **app:** don't fetch conditions on home page load ([c0e0e19](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/c0e0e19253513036108d19a42973846af297b952))
* attach video element to DOM before loading on iOS Safari ([49a3361](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/49a3361859c48ec4c144ecbffaf3bd9cade76ea0))
* clean up tryLoad event listeners; skip MIME blob fallbacks on iOS; add success logs and better error ([74f8e80](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/74f8e8060e1510ebd3193afb91388e1b1485a721))
* contain algae label overflow in day cards and widen VizTrace last column ([9c247f7](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/9c247f7a953605e38e777f79e9132e307ccdb940))
* **feed:** reset pagination synchronously on scope/filter change ([237e711](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/237e711c1d59fc1b0384e999a8083e3064e32ccc))
* force iOS Safari video load via play() and add diagnostics ([a6585d4](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/a6585d4be5ce4f9328faae0f184612433116a668))
* high-priority frontend races, a11y focus trap, and spot-crypto robustness ([7590bd2](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/7590bd2447177cff008c96a3db97747f74976b67)), closes [#154](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/154) [#152](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/152)
* move OpenCV loading and DCP analysis into a Web Worker ([71caba9](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/71caba9467b01e0cdae2b9bf316882f7aa867817))
* normalize video/quicktime MIME to video/mp4 for blob URLs and add SRC_NOT_SUPPORTED retry ([a6b8a7d](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/a6b8a7db3ccfce4d1e59f10c051583a33a22f6d9))
* persist cache to localStorage and auto-load last location on startup ([9dc37a8](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/9dc37a8bddb9bc15524cc25780d9172c8cc4de25))
* prevent iOS SRC_NOT_SUPPORTED by removing autoplay, improving retry logic with direct File URL fallback ([aaa3bda](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/aaa3bda1acb4b5ce10e6ae5ba3beba3f3251952b))
* race import() against abort signal so the 60s timeout actually fires ([b69c956](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/b69c9562cbc92ee5413cfe6af11b49edcf1e1647))
* read file into ArrayBuffer on iOS before creating blob URL ([29fd275](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/29fd2757a49a1bcdd30e379693fd3ecb1743cb11))
* recalibrate verdict labels and fix ForecastStrip text wrapping ([6a73c11](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/6a73c119ebd97fa197329ae25eb932ae18107beb))
* regenerate package-lock.json without --legacy-peer-deps ([290643e](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/290643e7846b92250019f58fd611f825c51843b1))
* reject zero depth in seabed editor to match API gt=0 ([#155](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/155)) ([a471f2f](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/a471f2f815469f5c393f37e68fe1de005b14cf63))
* replace SVG annotation with HTML panel showing both S and W values ([869954a](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/869954a2e9a334588de82e5b714347fbb4623420))
* replace video.play() with autoplay attribute to avoid iOS SRC_NOT_SUPPORTED ([bb17898](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/bb17898ccb80f1db9415a7b65d3138d31b93bcbc))
* resolve all Dependabot CI failures with compatible upgrades ([5bcd0d4](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/5bcd0d4ea5d691d3cc282618ad0522db2e9f9e5c)), closes [#183](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/183) [#184](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/184) [#185](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/185) [#182](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/182) [#179](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/179)
* retry video load with original MIME type when remapped type fails ([80aed7c](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/80aed7c72daf557a876c59dc66847973be87798e))
* scope SW forecast/tides cache to /api/; drop CSP-blocked tile caching ([32eb866](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/32eb866d89cefb0df21ad7d121f033438f791ffa)), closes [#174](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/174) [#171](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/171)
* server-verified admin gating and patch vulnerable esbuild/vite ([00929ac](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/00929ac4a6662a6afc7b19f0349470d5a168ec75)), closes [#149](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/149) [#150](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/150)
* set worker.format=es to allow dynamic import inside Web Worker ([7609e0f](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/7609e0f46eea4e47e49a53019b3e0c91dd6e85aa))
* stop forcing day label for selected bar in SwellChart ([544f086](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/544f086ba1d1b29c41498303bd1b64082c23d151))
* stop iOS worker hang by downsampling frames and statically bundling OpenCV ([0d685ca](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/0d685caf647508164e2804ee9e49d6f0e71acd4f))
* suppress vis_corrected_offset display when it rounds to ±0.0m ([6bb357b](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/6bb357bc1f7d4383e27e741e1dcf3515f80f588d))
* update nginx CSP to match live config and add unsafe-eval for OpenCV.js ([1b7fc85](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/1b7fc8553befaed94b8df1f1565a4bf004165290))


### Features

* add Brown's Bay + more spots, user-add-spot feature with localStorage ([2052fad](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/2052fade38f26fb35ec1cdc9fa83395a54084f4e))
* add dive depth selector and wire maxDiveDepth to DayDetail ([5abcfb8](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/5abcfb8f2c05904a18ea6e96fe76823019a566bb))
* add explanatory note when water clarity source is FALLBACK ([6ace512](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/6ace51296e17052aa732934fa5a3220390ee6f50))
* add getShallowWaterConfidence and shallow note styles ([4627145](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/46271455953ae81afc6f628143799b95e50ca046))
* add missing UK dive spots including Seaton Sluice ([025b3cc](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/025b3cc914cd63f5bdab16c42a7fdf7b40ff7a4f))
* add public/private toggle, 100m proximity check, and voting system to SpotsMap ([33b8e59](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/33b8e598bf4f55657084f80b8024da9fe4d5d563))
* add semantic versioning and verbose deploy logging ([46b113e](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/46b113eceea6afe99e559d37a99514e408e4ca5c))
* add shallow-water advisory to DayDetail ([07808e8](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/07808e84aadbff5c40a2cacd80c1a6776dde038b))
* **admin:** richer data overview dashboard + AdminPanel robustness ([9326559](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/9326559c8949aa20efab43d1a81ef3fb6df72cb2)), closes [#169](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/169) [#169](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/169) [#158](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/158)
* auto-select forecast location in dive log form and add My Places page ([82fb2bd](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/82fb2bd2461337d7a0e7ab7dbae1e3146c6b2ff3))
* installable PWA with offline support ([#171](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/171)) ([1aaafd0](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/1aaafd0131a937969c998355398a2a19e4634deb))
* **nav:** move Weight calculator to bottom bar, relocate Friends to Profile ([708a674](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/708a674eeb29ad1c4801699fc2e125a23da6cd1d))
* seabed/depth editor + resuspension recovery display ([#155](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/155)) ([ae6fda2](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/ae6fda2db57b738025e7c0eb2fe94ae9c67125e4))
* show map by default on initial visit ([3413c60](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/3413c60c19c385d082e3e5de6e81f42679242ba6))
* visually distinguish FALLBACK badge from real data source badges ([95de02c](https://github.com/jamesljeffrey1995/depthviz-frontend/commit/95de02cd0adeef417160d916f6e73cc3ba36d021)), closes [#d4850](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/d4850) [#00c9](https://github.com/jamesljeffrey1995/depthviz-frontend/issues/00c9)
