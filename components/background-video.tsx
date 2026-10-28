export function BackgroundVideo({ enabled, tint, variant = "app" }: { enabled: boolean; tint: string; variant?: "app" | "login" }) {
  const videoSource = variant === "login" ? "/videos/login-bg-video.mp4" : "/videos/app-bg-video.mp4";
  return <div className="scene-background" aria-hidden="true">
    {enabled && <video className="scene-video" autoPlay loop muted playsInline preload="metadata"><source src={videoSource} type="video/mp4" /></video>}
    <div className="scene-overlay" />
    <div className="scene-tint" style={{ backgroundColor: tint }} />
    <div className="scene-grain" />
  </div>;
}