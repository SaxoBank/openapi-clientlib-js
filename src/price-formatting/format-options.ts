/**
 * Options for price formatting.
 * The intention is for this enumeration to stay in sync with the open api price formatting enumeration. However, at present
 * this supports more than what open api exposes.
 * @example
 * var priceFormatOptions = saxo.priceFormatOptions;
 * priceFormatting.format(1.23, 2, priceFormatOptions.ModernFractions);
 */
const PriceFormatOptions = {
    /** @member {string} saxo.priceFormatOptions.Normal - Use only specified (number of decimals/fraction size).*/
    Normal: 'Normal',

    /** @member {string} saxo.priceFormatOptions.AdjustFractions - Pad fractional formats with spaces, e.g. "7/128" -> "  7/128"
        Only used with fractional formats (decimals &lt; 0).*/
    AdjustFractions: 'AdjustFractions',

    /** @member {string} saxo.priceFormatOptions.IncludeZeroFractions - Include fractions that are zero, e.g. "42" -&gt; "42 0/8"
        Only used with fractional formats (decimals &lt; 0). */
    IncludeZeroFractions: 'IncludeZeroFractions',

    /** @member {string} saxo.priceFormatOptions.ModernFractions - Special US Bonds futures fractional format (1/32s without nominator).
       1/32 fractional (decimals: -5) or with 1/2 or 1/4 of 1/32 extra precison (decimals: -6, -7)
       e.g. 102.9140625 == 102 29/32 + 1/128 -&gt; "102'29.25"
       Only used with fractional formats (decimals &lt; 0).*/
    ModernFractions: 'ModernFractions',

    /** @member {string} saxo.priceFormatOptions.Percentage - Show as a percentage. */
    Percentage: 'Percentage',

    /** @member {string} saxo.priceFormatOptions.Fractions - Show as a fraction */
    Fractions: 'Fractions',

    // CONSIDER: Adding support for using normal spaces instead of no-break spaces
    // NormalSpaces

    /** @member {string} saxo.priceFormatOptions.FormatAsPips - format the price as a number of pips rather than an absolute price */
    FormatAsPips: 'FormatAsPips',

    /** @member {string} saxo.priceFormatOptions.AllowDecimalPips - Use digits for deci/half-pips. */
    AllowDecimalPips: 'AllowDecimalPips',
    /** @member {string} saxo.priceFormatOptions.AllowTwoDecimalPips - Use two digits for decimal pips. */
    AllowTwoDecimalPips: 'AllowTwoDecimalPips',
    /** @member {string} saxo.priceFormatOptions.DeciPipsSpaceSeparator - Use a space as separator between pips and deci-pips. */
    DeciPipsSpaceSeparator: 'DeciPipsSpaceSeparator',
    /** @member {string} saxo.priceFormatOptions.DeciPipsDecimalSeparator - Use culture specific decimal separator as separator.
     *  Only used with AllowDecimalPips. */
    DeciPipsDecimalSeparator: 'DeciPipsDecimalSeparator',
    /** @member {string} saxo.priceFormatOptions.DeciPipsFraction - Use '1/2' fraction character for half-pips. */
    DeciPipsFraction: 'DeciPipsFraction',
    /** @member {string} saxo.priceFormatOptions.DeciPipsSpaceForZero - Use a space instead of zero.
     *  Only used with DeciPipsFraction. */
    DeciPipsSpaceForZero: 'DeciPipsSpaceForZero',
    /** @member {string} saxo.priceFormatOptions.UseExtendedDecimals - Use up to eight non-zero decimal digits in total. */
    UseExtendedDecimals: 'UseExtendedDecimals',
    /** @member {string} saxo.priceFormatOptions.NoRounding - Indicates that no rounding should be done - that
     *  decimals should be treated as a max decimals. */
    NoRounding: 'NoRounding',
} as const;

// The following are currently unused, but as open api expands, they may be required in the future.
// They are aggregate definitions
/* DeciPipsFractionOrSpace Use '1/2' or ' ' (no-break Space) for half-pips. */
// "DeciPipsFractionOrSpace": [PriceFormatOptions.DeciPipsFraction, PriceFormatOptions.DeciPipsSpaceForZero],
/* AllowDecimalPipsWithSpaceSeparator Use digits for deci-pips with a (non-break) space as separator between pips and deci-pips. */
// "AllowDecimalPipsWithSpaceSeparator": [PriceFormatOptions.DeciPipsSpaceSeparator, PriceFormatOptions.AllowDecimalPips],
/* AllowDecimalPipsWithDecimalSeparator Use digits for deci-pips with a decimal separator between pips and deci-pips. */
// "AllowDecimalPipsWithDecimalSeparator": [PriceFormatOptions.DeciPipsDecimalSeparator, PriceFormatOptions.AllowDecimalPips]

export type PriceFormatOption = keyof typeof PriceFormatOptions;

export default PriceFormatOptions;
