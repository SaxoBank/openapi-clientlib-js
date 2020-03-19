/**
 * @module saxo/price-formatting/modern-fractions-character
 * @ignore
 */

// -- Local variables section --

const modernFractionsSeparator = "'"; // US T-Bond/T-Note future decimal separator (104'16.5)
const altModernFractionsSeparator = '"'; // For the people using ' as thousand separator

// -- Local methods section --

// -- Exported methods section --

function getModernFractionsSeparator(numberFormatting) {
    let separator = modernFractionsSeparator;

    if (numberFormatting.groupSeparator === modernFractionsSeparator) {
        separator = altModernFractionsSeparator;
    }
    return separator;
}

// -- Export section --

export { getModernFractionsSeparator };
