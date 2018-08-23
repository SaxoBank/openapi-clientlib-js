/**
 * Exposes an enumeration object of PriceFormatOptions.
 * @module saxo/price-formatting/format-options
 * @ignore
 */

import * as enumUtils from '../utils/enum';

// -- Local variables section --

// -- Local methods section --

// -- Exported variables section --

/**
 * Options for price formatting.
 * The intention is for this enumeration to stay in sync with the open api price formatting enumeration. However, at present
 * this supports more than what open api exposes.
 * @namespace saxo.priceFormatOptions
 * @example
 * var priceFormatOptions = saxo.priceFormatOptions;
 * priceFormatting.format(1.23, 2, priceFormatOptions.ModernFractions);
 */
const PriceFormatOptions = enumUtils.makeDefinition([
    /** @member {string} saxo.priceFormatOptions.Normal - Use only specified (number of decimals/fraction size).*/
    'Normal',

    /** @member {string} saxo.priceFormatOptions.AdjustFractions - Pad fractional formats with spaces, e.g. "7/128" -> "  7/128"
        Only used with fractional formats (decimals &lt; 0).*/
    'AdjustFractions',

    /** @member {string} saxo.priceFormatOptions.IncludeZeroFractions - Include fractions that are zero, e.g. "42" -&gt; "42 0/8"
        Only used with fractional formats (decimals &lt; 0). */
    'IncludeZeroFractions',

    /** @member {string} saxo.priceFormatOptions.ModernFractions - Special US Bonds futures fractional format (1/32s without nominator).
       1/32 fractional (decimals: -5) or with 1/2 or 1/4 of 1/32 extra precison (decimals: -6, -7)
       e.g. 102.9140625 == 102 29/32 + 1/128 -&gt; "102'29.25"
       Only used with fractional formats (decimals &lt; 0).*/
    'ModernFractions',

    /** @member {string} saxo.priceFormatOptions.Percentage - Show as a percentage. */
    'Percentage',

    /** @member {string} saxo.priceFormatOptions.Fractions - Show as a fraction */
    'Fractions',

    // CONSIDER: Adding support for using normal spaces instead of no-break spaces
    // NormalSpaces

    /** @member {string} saxo.priceFormatOptions.AllowDecimalPips - Use digits for deci/half-pips. */
    'AllowDecimalPips',
    /** @member {string} saxo.priceFormatOptions.FormatAsPips - Render the price as pips. */
    'FormatAsPips',
    /** @member {string} saxo.priceFormatOptions.DeciPipsSpaceSeparator - Use a space as separator between pips and deci-pips. */
    'DeciPipsSpaceSeparator',
    /** @member {string} saxo.priceFormatOptions.DeciPipsDecimalSeparator - Use culture specific decimal separator as separator.
      *  Only used with AllowDecimalPips. */
    'DeciPipsDecimalSeparator',
    /** @member {string} saxo.priceFormatOptions.DeciPipsFraction - Use '1/2' fraction character for half-pips. */
    'DeciPipsFraction',
    /** @member {string} saxo.priceFormatOptions.DeciPipsSpaceForZero - Use a space instead of zero.
      *  Only used with DeciPipsFraction. */
    'DeciPipsSpaceForZero',
    /** @member {string} saxo.priceFormatOptions.NoRounding - Indicates that no rounding should be done - that
      *  decimals should be treated as a max decimals. */
    'NoRounding']);

    // The following are currently unused, but as open api expands, they may be required in the future.
    // They are aggregate definitions
    /* DeciPipsFractionOrSpace Use '1/2' or ' ' (no-break Space) for half-pips. */
    // "DeciPipsFractionOrSpace": [PriceFormatOptions.DeciPipsFraction, PriceFormatOptions.DeciPipsSpaceForZero],
    /* AllowDecimalPipsWithSpaceSeparator Use digits for deci-pips with a (non-break) space as separator between pips and deci-pips. */
    // "AllowDecimalPipsWithSpaceSeparator": [PriceFormatOptions.DeciPipsSpaceSeparator, PriceFormatOptions.AllowDecimalPips],
    /* AllowDecimalPipsWithDecimalSeparator Use digits for deci-pips with a decimal separator between pips and deci-pips. */
    // "AllowDecimalPipsWithDecimalSeparator": [PriceFormatOptions.DeciPipsDecimalSeparator, PriceFormatOptions.AllowDecimalPips]

// -- Export section --

export default PriceFormatOptions;
