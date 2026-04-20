# CSS Learning References

## MDN Web Docs
https://developer.mozilla.org/en-US/docs/Web/CSS

The gold standard CSS reference. Accurate and complete.
Key pages:
- Cascade and inheritance: https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Cascade_and_inheritance
- Specificity: https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity
- Flexbox: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout

## CSS Tricks
https://css-tricks.com

Practical articles and guides.
Key pages:
- Complete Guide to Flexbox: https://css-tricks.com/snippets/css/a-guide-to-flexbox/
- Complete Guide to Grid: https://css-tricks.com/snippets/css/complete-guide-grid/

## web.dev Learn CSS (Google)
https://web.dev/learn/css

Structured course from basics to advanced, good for building knowledge in order.

## Specificity Calculator
https://specificity.keegan.st

Paste any CSS selector and see exactly how specific it is.
Useful when two rules conflict and you can't figure out why one wins.

## Quick Specificity Rules
- Element selector (button)         = lowest specificity
- Class selector (.my-button)       = medium specificity  
- ID selector (#meld)               = high specificity
- inline style (style="...")        = highest specificity
- Same specificity = last rule in file wins
- font-size on a container does NOT automatically apply to button children
