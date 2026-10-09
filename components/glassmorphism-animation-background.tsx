export function GlassmorphismAnimationBackground() {
  return (
    <div className="glass-animation-background" aria-hidden="true">
      <span className="glass-glow-orb glass-glow-orb-blue" />
      <span className="glass-glow-orb glass-glow-orb-violet" />
      <span className="glass-glow-orb glass-glow-orb-gold" />
      <div className="glass-wave glass-wave-one" />
      <div className="glass-wave glass-wave-two" />
      <TransparentVideoPlaceholder />
    </div>
  );
}

function TransparentVideoPlaceholder() {
  // Replace this placeholder with the future transparent MP4 element.
  return <div className="glass-video-placeholder" data-video-placeholder="login-background" />;
}
