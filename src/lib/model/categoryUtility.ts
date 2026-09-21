/** Equal-category utility, not a calibrated probability. Reuses Stage 5's
 * existing width: a neutral-to-dominant gain tends to width in every category.
 */
export function categoryUtilityGain(beforeMargin:number, productionGain:number, width:number) {
  return width*(Math.tanh((beforeMargin+productionGain)/width)-Math.tanh(beforeMargin/width));
}
