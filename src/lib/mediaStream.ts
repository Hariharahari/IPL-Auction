// Singleton MediaStream manager for webcam and studio virtual cam
type StreamListener = (stream: MediaStream | null) => void;

let currentStream: MediaStream | null = null;
let virtualCamInterval: NodeJS.Timeout | null = null;
const listeners = new Set<StreamListener>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(currentStream);
    } catch (err) {
      console.warn('MediaStream listener error:', err);
    }
  });
}

export function subscribeToMediaStream(listener: StreamListener): () => void {
  listeners.add(listener);
  listener(currentStream);
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentMediaStream(): MediaStream | null {
  return currentStream;
}

export function stopMediaStream(): void {
  if (virtualCamInterval) {
    clearInterval(virtualCamInterval);
    virtualCamInterval = null;
  }
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
    notifyListeners();
  }
}

export async function startWebcamStream(): Promise<MediaStream> {
  stopMediaStream();

  if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Webcam is not supported in this browser environment.');
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
  }

  currentStream = stream;
  notifyListeners();
  return stream;
}

export function startVirtualCamStream(userName: string = 'Broadcaster'): MediaStream {
  stopMediaStream();

  if (typeof document === 'undefined') {
    throw new Error('Canvas rendering requires browser DOM.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  let frame = 0;
  const render = () => {
    frame++;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 1280, 720);
    grad.addColorStop(0, '#020617');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);

    // Decorative studio pulse
    ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
    ctx.beginPath();
    ctx.arc(640, 360, 260 + Math.sin(frame * 0.05) * 20, 0, Math.PI * 2);
    ctx.fill();

    // User Avatar Circle
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(640, 300, 85, 0, Math.PI * 2);
    ctx.fill();

    // Initial letter
    ctx.fillStyle = '#020617';
    ctx.font = '900 80px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = (userName || 'A').charAt(0).toUpperCase();
    ctx.fillText(initial, 640, 305);

    // Broadcaster Name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 36px system-ui, sans-serif';
    ctx.fillText(userName, 640, 435);

    // Subtitle
    ctx.fillStyle = '#F59E0B';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText('IPL LIVE AUCTION STAGE • STUDIO BROADCAST FEED', 640, 475);

    // Audio Waveform
    for (let i = 0; i < 30; i++) {
      const h = 14 + Math.sin(frame * 0.15 + i * 0.45) * 28;
      ctx.fillStyle = i % 2 === 0 ? '#F59E0B' : '#38BDF8';
      ctx.fillRect(490 + i * 10, 560 - h / 2, 6, h);
    }

    // Live REC indicator
    ctx.fillStyle = frame % 60 < 30 ? '#EF4444' : '#991B1B';
    ctx.beginPath();
    ctx.arc(80, 60, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('STUDIO VIRTUAL CAM 720p', 105, 66);
  };

  virtualCamInterval = setInterval(render, 1000 / 30);
  const stream = canvas.captureStream(30);

  const track = stream.getVideoTracks()[0];
  if (track) {
    const origStop = track.stop.bind(track);
    track.stop = () => {
      if (virtualCamInterval) {
        clearInterval(virtualCamInterval);
        virtualCamInterval = null;
      }
      origStop();
    };
  }

  currentStream = stream;
  notifyListeners();
  return stream;
}
