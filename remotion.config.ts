import {Config} from '@remotion/cli/config';

// three.js renders black in headless Chromium without a real GL backend.
Config.setChromiumOpenGlRenderer('angle');
Config.setEntryPoint('src/index.ts');
// Reels delivery: 1080x1920, H.264 High, yuv420p, CRF 18. Compositions are 1080x1920 at 30 fps.
Config.overrideWidth(1080);
Config.overrideHeight(1920);
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');
Config.setVideoImageFormat('png');
