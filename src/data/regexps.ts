export const reLower = () => /[a-z]/g;
export const reUpper = () => /[A-Z]/g;
export const reDigit = () => /[0-9]/g;
export const reSpecial = () => /[^a-zA-Z0-9]/g;

export const rePSM = () =>
  /weak|so-so|good|great|fair|strong|medium|best|okay|perfect|poor|moderate|excellent|low|high|strength|security|level/i;

export const rePVW = () =>
  /word|letter|character|upper[\s-]?case|lower[\s-]?case|digit|number|symbol|special/i;
