export function BackgroundVideo({ enabled, tint }: { enabled: boolean; tint: string }) {
  return <div className="scene-background" aria-hidden="true">
    {enabled && <video className="scene-video" autoPlay loop muted playsInline preload="metadata"><source src="/videos/bg-video.mp4" type="video/mp4" /></video>}
    <div className="scene-tint" style={{ backgroundColor: tint }} />
    <div className="scene-grain" />
  </div>;
}