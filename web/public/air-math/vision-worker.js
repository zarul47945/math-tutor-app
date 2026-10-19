/* Camera inference stays off the animation thread. Only one frame is in flight. */
importScripts("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/vision_bundle.js");

let fileset;
let config;
let hands;
let segmenter;
let segmentationLoading;
let underwater = false;
let handDelegate = "CPU";
let cutoutDelegate = "CPU";
let lastSegmentationTime = -Infinity;
let segmentationInterval = 100;
let segmentationCost = 20;
let maskCanvas;
let maskContext;
let maskPixels;
let hardwareGpu;

function hasHardwareGpu() {
  if (hardwareGpu !== undefined) return hardwareGpu;
  hardwareGpu = false;
  if (typeof OffscreenCanvas === "undefined") return false;
  try {
    const gl = new OffscreenCanvas(1, 1).getContext("webgl2");
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    hardwareGpu = !/swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(renderer);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch { /* Use the CPU worker if WebGL is unavailable. */ }
  return hardwareGpu;
}

async function createTask(Task, options, forceCpu = false) {
  if (!forceCpu && hasHardwareGpu()) {
    try {
      const task = await Task.createFromOptions(fileset, {
        ...options,
        canvas: new OffscreenCanvas(1, 1),
        baseOptions: { ...options.baseOptions, delegate: "GPU" },
      });
      return { task, delegate: "GPU" };
    } catch { /* CPU in the worker also leaves the UI responsive. */ }
  }
  return {
    task: await Task.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: "CPU" } }),
    delegate: "CPU",
  };
}

async function createHands(forceCpu = false) {
  const created = await createTask(Vision.HandLandmarker, {
    baseOptions: { modelAssetPath: config.modelUrl },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: .6,
    minHandPresenceConfidence: .6,
    minTrackingConfidence: .6,
  }, forceCpu);
  hands = created.task;
  handDelegate = created.delegate;
}

async function createSegmenter(forceCpu = false) {
  const created = await createTask(Vision.ImageSegmenter, {
    baseOptions: { modelAssetPath: config.segmentationModelUrl },
    runningMode: "VIDEO",
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  }, forceCpu);
  segmenter = created.task;
  cutoutDelegate = created.delegate;
  segmentationInterval = cutoutDelegate === "GPU" ? 80 : 110;
}

function ensureSegmentation() {
  if (segmenter || segmentationLoading) return;
  segmentationLoading = createSegmenter().then(() => {
    self.postMessage({ type: "segmentation-ready", delegate: cutoutDelegate });
  }).catch((error) => {
    self.postMessage({ type: "segmentation-error", message: error.message });
  }).finally(() => { segmentationLoading = null; });
}

function copyMask(result) {
  const mask = result.confidenceMasks?.[0];
  if (!mask) throw new Error("Player mask unavailable");
  if (!maskCanvas || maskCanvas.width !== mask.width || maskCanvas.height !== mask.height) {
    maskCanvas = new OffscreenCanvas(mask.width, mask.height);
    maskContext = maskCanvas.getContext("2d");
    maskPixels = maskContext.createImageData(mask.width, mask.height);
    for (let i = 0; i < maskPixels.data.length; i += 4) {
      maskPixels.data[i] = maskPixels.data[i + 1] = maskPixels.data[i + 2] = 255;
    }
  }
  // Borrowed MediaPipe mask memory is consumed before this callback returns.
  const values = mask.getAsFloat32Array();
  for (let i = 0; i < values.length; i++) {
    const alpha = Math.max(0, Math.min(1, (values[i] - .18) / .62));
    maskPixels.data[i * 4 + 3] = Math.round(alpha * alpha * (3 - 2 * alpha) * 255);
  }
  maskContext.putImageData(maskPixels, 0, 0);
  return maskCanvas.transferToImageBitmap();
}

async function processFrame({ frame, timestamp }) {
  const started = performance.now();
  let mask;
  try {
    let result;
    try {
      result = hands.detectForVideo(frame, timestamp);
    } catch (error) {
      if (handDelegate !== "GPU") throw error;
      hands.close();
      await createHands(true);
      result = hands.detectForVideo(frame, timestamp);
    }
    const handTime = performance.now() - started;
    self.postMessage({ type: "hand-result", landmarks: result.landmarks[0] || null, handMs: handTime, delegate: handDelegate });
    if (underwater && result.landmarks[0] && segmenter && timestamp - lastSegmentationTime >= segmentationInterval) {
      lastSegmentationTime = timestamp;
      const maskStarted = performance.now();
      try {
        segmenter.segmentForVideo(frame, timestamp, (segmentation) => { mask = copyMask(segmentation); });
        segmentationCost = segmentationCost * .8 + (performance.now() - maskStarted) * .2;
        // Leave most processing time for responsive pinch tracking on slow devices.
        segmentationInterval = Math.max(cutoutDelegate === "GPU" ? 80 : 110, Math.min(300, segmentationCost * 4));
      } catch (error) {
        segmenter.close();
        segmenter = null;
        if (cutoutDelegate === "GPU") {
          try {
            await createSegmenter(true);
            self.postMessage({ type: "segmentation-ready", delegate: cutoutDelegate });
          } catch (fallbackError) {
            self.postMessage({ type: "segmentation-error", message: fallbackError.message });
          }
        } else {
          self.postMessage({ type: "segmentation-error", message: error.message });
        }
      }
    }
    self.postMessage({
      type: "result",
      timestamp,
      handMs: handTime,
      duration: performance.now() - started,
      handDelegate,
      cutoutDelegate,
      mask,
    }, mask ? [mask] : []);
  } catch (error) {
    mask?.close();
    self.postMessage({ type: "tracking-error", message: error.message });
  } finally {
    frame.close();
  }
}

self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      config = data;
      fileset = await Vision.FilesetResolver.forVisionTasks(config.wasmRoot);
      await createHands();
      self.postMessage({ type: "ready", delegate: handDelegate });
    } catch (error) {
      self.postMessage({ type: "init-error", message: error.message });
    }
  } else if (data.type === "mode") {
    underwater = data.underwater;
    if (underwater) {
      if (segmenter) self.postMessage({ type: "segmentation-ready", delegate: cutoutDelegate });
      else ensureSegmentation();
    }
  } else if (data.type === "frame") {
    if (hands) await processFrame(data);
    else { data.frame.close(); self.postMessage({ type: "tracking-error", message: "Hand tracking is not ready" }); }
  }
};
