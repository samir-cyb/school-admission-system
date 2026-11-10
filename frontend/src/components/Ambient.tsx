/**
 * Soft light behind the glass surfaces, in the brand family (navy, teal, amber).
 * Purely decorative and static: painted with CSS gradients only, so it costs nothing per frame.
 */
export function Ambient() {
  return <div className="ambient" aria-hidden />;
}
