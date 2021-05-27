import type NumberFormatting from '../number-formatting';

const modernFractionsSeparator = "'"; // US T-Bond/T-Note future decimal separator (104'16.5)
const altModernFractionsSeparator = '"'; // For the people using ' as thousand separator

function getModernFractionsSeparator(numberFormatting: NumberFormatting) {
    let separator = modernFractionsSeparator;

    if (numberFormatting.groupSeparator === modernFractionsSeparator) {
        separator = altModernFractionsSeparator;
    }
    return separator;
}

export { getModernFractionsSeparator };
