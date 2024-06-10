import { useRef, useState } from "react";
import teikyo from "./assets/teikyo.png";

import * as faceapi from "face-api.js";

const loadModels = async () => {
  await faceapi.nets.tinyFaceDetector.load("models/");
  await faceapi.nets.faceLandmark68Net.load("models/");
};

type Pos = { x: number; y: number };

const center = (pos1: Pos, pos2: Pos) => {
  return {
    x: (pos1.x + pos2.x) / 2,
    y: (pos1.y + pos2.y) / 2,
  };
};

const distance = (pos1: Pos, pos2: Pos) => {
  const distance = Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
  );
  return distance;
};

const smoothingQueue: { [key: string]: number[] } = {};
const smoothing = (value: number, key: string) => {
  if (!smoothingQueue[key]) {
    smoothingQueue[key] = [];
  }
  smoothingQueue[key].push(value);
  if (smoothingQueue[key].length > 3) {
    smoothingQueue[key].shift();
  }
  return (
    smoothingQueue[key].reduce((acc, cur) => acc + cur, 0) /
    smoothingQueue[key].length
  );
};

// const TEIKYO_ORIGINAL_WIDTH = 400;
// const TEIKYO_ORIGINAL_HEIGHT = 250;
const TEIKYO_ORIGINAL_LEFT_EYE_CENTER = { x: 164, y: 55 };
const TEIKYO_OROGINAL_RIGHT_EYE_CENTER = { x: 236, y: 55 };
const TEIKYO_ORIGINAL_EYE_DISTANCE = distance(
  TEIKYO_ORIGINAL_LEFT_EYE_CENTER,
  TEIKYO_OROGINAL_RIGHT_EYE_CENTER
);

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const teikyoRef = useRef<HTMLImageElement | null>(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isShowCanvas, setIsShowCanvas] = useState(true);
  const [isShowTeikyo, setIsShowTeikyo] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);

  const lanuchWebCam = async () => {
    if (!videoRef.current) {
      return;
    }
    videoRef.current.srcObject = await navigator.mediaDevices.getUserMedia({
      video: {},
    });
    setIsCameraEnabled(true);
  };
  const isDetectingRef = useRef(false);
  const faceDetectionTimer = useRef<number | null>(null);
  const startFaceLandmarkDetection = async () => {
    await loadModels();
    isDetectingRef.current = true;
    setIsDetecting(true);
    detect();
  };
  const stopFaceLandmarkDetection = () => {
    console.log("stop", faceDetectionTimer);
    if (faceDetectionTimer.current) {
      clearTimeout(faceDetectionTimer.current);
    }
    isDetectingRef.current = false;
    setIsDetecting(false);
  };
  const detect = async () => {
    if (!videoRef.current || !isDetectingRef.current) {
      return;
    }
    const faceDetectionWithFaceLandmarks = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();
    if (faceDetectionWithFaceLandmarks) {
      draw(faceDetectionWithFaceLandmarks);
    }
    faceDetectionTimer.current = setTimeout(detect, 0);
  };
  const draw = (
    faceDetectionWithFaceLandmarks: faceapi.WithFaceLandmarks<{
      detection: faceapi.FaceDetection;
    }>
  ) => {
    if (!canvasRef.current || !videoRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const displaySize = {
      width: video.width,
      height: video.height,
    };
    faceapi.matchDimensions(canvas, displaySize);
    const detections = faceapi.resizeResults(
      faceDetectionWithFaceLandmarks,
      displaySize
    );
    const landMarks = detections.landmarks;
    const leftEyeCenter = center(
      landMarks.getLeftEye()[0],
      landMarks.getLeftEye()[3]
    );
    const rightEyeCenter = center(
      landMarks.getRightEye()[0],
      landMarks.getRightEye()[3]
    );
    faceapi.draw.drawFaceLandmarks(canvas, landMarks);
    const drawEyeDot = () => {
      ctx.beginPath();
      ctx.arc(leftEyeCenter.x, leftEyeCenter.y, 5, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rightEyeCenter.x, rightEyeCenter.y, 5, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();
    };
    drawEyeDot();
    ajustTeikyo(leftEyeCenter, rightEyeCenter);
  };

  const ajustTeikyo = (leftEyeCenter: Pos, rightEyeCenter: Pos) => {
    if (!teikyoRef.current) {
      return;
    }
    const teikyo = teikyoRef.current;
    const scale =
      distance(leftEyeCenter, rightEyeCenter) / TEIKYO_ORIGINAL_EYE_DISTANCE;
    const rotation = Math.atan2(
      rightEyeCenter.y - leftEyeCenter.y,
      rightEyeCenter.x - leftEyeCenter.x
    );
    teikyo.style.transformOrigin = `${TEIKYO_ORIGINAL_LEFT_EYE_CENTER.x}px ${TEIKYO_ORIGINAL_LEFT_EYE_CENTER.y}px`;
    teikyo.style.scale = `${smoothing(scale, "scale")}`;
    teikyo.style.rotate = `${smoothing(rotation, "rotation")}rad`;
    teikyo.style.top = `${smoothing(
      leftEyeCenter.y - TEIKYO_ORIGINAL_LEFT_EYE_CENTER.y,
      "top"
    )}px`;
    teikyo.style.left = `${smoothing(
      leftEyeCenter.x - TEIKYO_ORIGINAL_LEFT_EYE_CENTER.x,
      "left"
    )}px`;
  };

  return (
    <>
      <div className="flex flex-col gap-1 items-center">
        <div className="relative w-[480px] h-[360px] mt-4">
          <video
            ref={videoRef}
            id="video"
            width="480"
            height="360"
            autoPlay
            muted
            className="absolute top-0 left-0 z-30"
          ></video>
          <canvas
            ref={canvasRef}
            className={[
              "t-bg-transparent absolute top-0 left-0 opacity-50 z-40",
              isShowCanvas ? "" : "invisible",
            ].join(" ")}
          />
          <div className="absolute top-0 left-0 z-50 w-[480px] h-[360px] overflow-hidden">
            <img
              ref={teikyoRef}
              src={teikyo}
              alt="teikyo"
              className={[
                "absolute w-[400px] h-[250px]",
                isShowTeikyo ? "" : "invisible",
              ].join(" ")}
            />
          </div>
          {!isCameraEnabled && (
            <div className="z-50 absolute bg-slate-100 w-full h-full flex items-center justify-center">
              <button
                className="w-60 h-20  rounded-md bg-sky-500 text-white shadow-md hover:bg-sky-600"
                onClick={lanuchWebCam}
              >
                カメラを起動
              </button>
            </div>
          )}
        </div>
        <div>提供目トラッカー</div>
        <div className="h-[100px]"></div>
        <div className="text-left flex flex-col">
          <button
            className={[
              "p-2 rounded-md  text-white shadow-md ",
              isDetecting
                ? "bg-red-500 hover:bg-red-600"
                : "bg-sky-500 hover:bg-sky-600",
            ].join(" ")}
            onClick={() => {
              isDetecting
                ? stopFaceLandmarkDetection()
                : startFaceLandmarkDetection();
            }}
          >
            トラッキングを{isDetecting ? "停止する" : "開始する"}
          </button>
          <div className="h-4"></div>
          <label>
            <input
              type="checkbox"
              checked={isShowTeikyo}
              onChange={() => {
                setIsShowTeikyo(!isShowTeikyo);
              }}
              className="mr-3"
            />
            提供画像
          </label>
          <label>
            <input
              type="checkbox"
              checked={isShowCanvas}
              onChange={() => {
                setIsShowCanvas(!isShowCanvas);
              }}
              className="mr-3"
            />
            ランドマーク
          </label>
        </div>
      </div>
    </>
  );
}

export default App;
