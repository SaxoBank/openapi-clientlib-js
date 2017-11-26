// Size summary
// JSON with numeric fields: 1086 bytes
// JSON: 1556
// Protobuf base64: 800 bytes
// Probobuf ByteArray: 600 bytes

export const schema = `syntax = "proto3"; 
import "google/protobuf/timestamp.proto"; 

option saxobank_root = "PriceResponse";

message PriceResponse {
   message Greeks {
      double delta = 1;
      double gamma = 2;
      double mid_vol = 3;
      double phi = 4;
      double rho = 5;
      double theta = 6;
      double vega = 7;
   }

   message HistoricalChanges {
      double percent_change1_month = 1;
      double percent_change1_year = 2;
      double percent_change2_months = 3;
      double percent_change2_years = 4;
      double percent_change3_months = 5;
      double percent_change5_years = 6;
      double percent_change6_months = 7;
      double percent_change_weekly = 8;
   }

   message InstrumentPriceDetails {
      double accrued_interest = 1;
      double ask_swap = 2;
      double bid_swap = 3;
      double cfd_borrowing_cost = 4;
      double cfd_hard_to_finance_rate = 5;
      bool cfd_price_adjustment = 6;
      bool dma = 7;
      double est_price_buy = 8;
      double est_price_sell = 9;
      google.protobuf.Timestamp expiry_date = 10;
      bool is_market_open = 11;
      double lower_barrier = 12;
      double mid_forward_price = 13;
      double mid_spot_price = 14;
      double mid_yield = 15;
      google.protobuf.Timestamp notice_date = 16;
      double open_interest = 17;
      double paid_cfd_interest = 18;
      double received_cfd_interest = 19;
      bool short_trade_disabled = 20;
      double spot_ask = 21;
      double spot_bid = 22;
      google.protobuf.Timestamp spot_date = 23;
      double strike_price = 24;
      double upper_barrier = 25;
      google.protobuf.Timestamp value_date = 26;
   }

   message MarginImpact {
      double impact_buy = 1;
      double impact_sell = 2;
      double initial_margin = 3;
      double maintenance_margin = 4;
   }

   message MarketDepth {
      repeated double ask = 1;
      repeated double ask_orders = 2;
      repeated double ask_size = 3;
      repeated double bid = 4;
      repeated double bid_orders = 5;
      repeated double bid_size = 6;
      int32 no_of_bids = 7;
      int32 no_of_offers = 8;
      bool using_orders = 9;
   }

   message PriceInfo {
      double high = 1;
      double low = 2;
      double net_change = 3;
      double percent_change = 4;
   }

   message TradableQuote {
      int32 amount = 1;
      double ask = 2;
      double bid = 3;
      int32 delayed_by_minutes = 4;
      string error_code = 5;
      double mid = 6;
      string price_type_ask = 7;
      string price_type_bid = 8;
      string quote_id = 9;
      string r_f_q_state = 10;
   }

   string asset_type = 1;
   Greeks greeks = 2;
   HistoricalChanges historical_changes = 3;
   InstrumentPriceDetails instrument_price_details = 4;
   google.protobuf.Timestamp last_updated = 5;
   MarginImpact margin_impact = 6;
   MarketDepth market_depth = 7;
   PriceInfo price_info = 8;
   string price_source = 9;
   TradableQuote quote = 10;
   int32 uic = 11;
}`;

export const fields = {
    'asset_type': {
        'type': 'string',
        'id': 1,
    },
    'greeks': {
        'type': 'Greeks',
        'id': 2,
    },
    'historical_changes': {
        'type': 'HistoricalChanges',
        'id': 3,
    },
    'instrument_price_details': {
        'type': 'InstrumentPriceDetails',
        'id': 4,
    },
    'last_updated': {
        'type': 'google.protobuf.Timestamp',
        'id': 5,
    },
    'margin_impact': {
        'type': 'MarginImpact',
        'id': 6,
    },
    'market_depth': {
        'type': 'MarketDepth',
        'id': 7,
    },
    'price_info': {
        'type': 'PriceInfo',
        'id': 8,
    },
    'price_source': {
        'type': 'string',
        'id': 9,
    },
    'quote': {
        'type': 'TradableQuote',
        'id': 10,
    },
    'uic': {
        'type': 'int32',
        'id': 11,
    },
};

// 1588 bytes raw JSON.
// 1118 bytes JSON with schema.
export const objectMessage = {
    'asset_type': 'FxOption',
    'greeks': {
        'delta': 10.323,
        'gamma': 11.32132,
        'mid_vol': 1000,
        'phi': 0.00123,
        'rho': 0.321,
        'theta': 0.32,
        'vega': 0.11,
    },
    'historical_changes': {
        'percent_change1_month': 1,
        'percent_change1_year': 2022,
        'percent_change2_months': 3,
        'percent_change2_years': 2012,
        'percent_change3_months': 5,
        'percent_change5_years': 2019,
        'percent_change6_months': 7,
        'percent_change_weekly': 8,
    },
    'instrument_price_details': {
        'accrued_interest': 1,
        'ask_swap': 2,
        'bid_swap': 3,
        'cfd_borrowing_cost': 4,
        'cfd_hard_to_finance_rate': 5,
        'cfd_price_adjustment': true,
        'dma': true,
        'est_price_buy': 8,
        'est_price_sell': 9,
        'expiry_date': {
            'seconds': '1510141304',
        },
        'is_market_open': true,
        'lower_barrier': 1.3213,
        'mid_forward_price': 1.1123,
        'mid_spot_price': 1.3231,
        'mid_yield': 1.2323,
        'notice_date': {
            'seconds': '1510141304',
        },
        'open_interest': 0.123,
        'paid_cfd_interest': 0.321,
        'received_cfd_interest': 0.11112,
        'short_trade_disabled': true,
        'spot_ask': 1.11,
        'spot_bid': 1.32,
        'spot_date': {
            'seconds': '1510141304',
        },
        'strike_price': 1.3212,
        'upper_barrier': 1.3331,
        'value_date': {
            'seconds': '1510141304',
        },
    },
    'last_updated': {
        'seconds': '1510141304',
    },
    'margin_impact': {
        'impact_buy': 1.32,
        'impact_sell': 2.13,
        'initial_margin': 1.11,
        'maintenance_margin': 1.321,
    },
    'market_depth': {
        'ask': [
            1.321,
            1.11,
        ],
        'ask_orders': [
            3.12,
            3.11,
        ],
        'ask_size': [
            1000,
            2000,
        ],
        'bid': [
            1.421,
            1.321,
        ],
        'bid_orders': [
            1.521,
            1.451,
        ],
        'bid_size': [
            2000,
            1200,
        ],
        'no_of_bids': 32,
        'no_of_offers': 72,
        'using_orders': true,
    },
    'price_info': {
        'high': 1.23,
        'low': 1.12,
        'net_change': 11,
        'percent_change': 0.12,
    },
    'price_source': 'NASDAQ',
    'quote': {
        'amount': 1230,
        'ask': 1.23,
        'bid': 1.11,
        'delayed_by_minutes': 23,
        'error_code': '1235',
        'mid': 1.15,
        'price_type_ask': 'asktype',
        'price_type_bid': 'bidtype',
        'quote_id': '12313cdadad',
        'r_f_q_state': 'idle',
    },
    'uic': 12332,
};

export const schemaOption = `syntax = "proto3";
    option saxobank_root = "InstrumentPriceDetails";
    
    message Greeks {
      double delta = 1;
      double gamma = 2;
      double mid_vol = 3;
      double phi = 4;
      double rho = 5;
      double theta = 6;
      double vega = 7;
   }

   message HistoricalChanges {
      double percent_change1_month = 1;
      double percent_change1_year = 2;
      double percent_change2_months = 3;
      double percent_change2_years = 4;
      double percent_change3_months = 5;
      double percent_change5_years = 6;
      double percent_change6_months = 7;
      double percent_change_weekly = 8;
   }

   message InstrumentPriceDetails {
      double accrued_interest = 1;
      double ask_swap = 2;
      double bid_swap = 3;
      double cfd_borrowing_cost = 4;
      double cfd_hard_to_finance_rate = 5;
      bool cfd_price_adjustment = 6;
      bool dma = 7;
      double est_price_buy = 8;
      double est_price_sell = 9;
      google.protobuf.Timestamp expiry_date = 10;
      bool is_market_open = 11;
      double lower_barrier = 12;
      double mid_forward_price = 13;
      double mid_spot_price = 14;
      double mid_yield = 15;
      google.protobuf.Timestamp notice_date = 16;
      double open_interest = 17;
      double paid_cfd_interest = 18;
      double received_cfd_interest = 19;
      bool short_trade_disabled = 20;
      double spot_ask = 21;
      double spot_bid = 22;
      google.protobuf.Timestamp spot_date = 23;
      double strike_price = 24;
      double upper_barrier = 25;
      google.protobuf.Timestamp value_date = 26;
      HistoricalChanges historical_change = 27;
      Greeks greeks = 28;
   }
`;

// 864 bytes
export const encodedMessage = 'CghGeE9wdGlvbhI/CUw3iUFgpSRAEfgZFw6EpCZAGQAAAAAAQI9AIdeGinH+JlQ/KSUGgZVDi9Q/MXsUrkfhetQ/OSlcj8L1KLw/GkgJAAAAAAAA8D8RAAAAAACYn0AZAAAAAAAACEAhAAAAAABwn0ApAAAAAAAAFEAxAAAAAACMn0A5AAAAAAAAHEBBAAAAAAAAIEAi1QEJAAAAAAAA8D8RAAAAAAAAAEAZAAAAAAAACEAhAAAAAAAAEEApAAAAAAAAFEAwATgBQQAAAAAAACBASQAAAAAAACJAUgYI+NqL0AVYAWHcRgN4CyT1P2nrc7UV+8vxP3HPZtXnaiv1P3nWxW00gLfzP4IBBgj42ovQBYkBsHJoke18vz+RASUGgZVDi9Q/mQEYeO49XHK8P6ABAakBw/UoXI/C8T+xAR+F61G4HvU/ugEGCPjai9AFwQFrmnecoiP1P8kB+MJkqmBU9T/SAQYI+NqL0AUqBgj42ovQBTIkCR+F61G4HvU/EQrXo3A9CgFAGcP1KFyPwvE/IYlBYOXQIvU/OnIKEIlBYOXQIvU/w/UoXI/C8T8SEPYoXI/C9QhA4XoUrkfhCEAaEAAAAAAAQI9AAAAAAABAn0AiECPb+X5qvPY/iUFg5dAi9T8qELx0kxgEVvg/nu+nxks39z8yEAAAAAAAQJ9AAAAAAADAkkA4IEBISAFCJAmuR+F6FK7zPxHsUbgehevxPxkAAAAAAAAmQCG4HoXrUbi+P0oGTkFTREFRUksIzgkRrkfhehSu8z8Zw/UoXI/C8T8gFyoEMTIzNTFmZmZmZmbyPzoHYXNrdHlwZUIHYmlkdHlwZUoLMTIzMTNjZGFkYWRSBGlkbGVYrGA=';

export function getJSONBytes() {
    return JSON.stringify(objectMessage).length;
}

export function getJSONSchemaBytes() {
    let i = 0;
    const jsonWithSchema = JSON.stringify(objectMessage).replace(/"[a-zA-Z _]+":/g, (v, index, a) => `"${i++}":`);
    return jsonWithSchema.length;
}

export const encodedMessageOrder = 'GtwC+gEINTEzOTQzMzYiBVhNSUtVKhh4dWNKS0pScDZpTmxzYTZJQmR1RmVBPT05AAAAAABq6EBKBkZ4U3BvdFIDQnV5WgJPa2oYcUFpdlgzaVBEbEZtaWNxOVJESXNHQT09eiRhMDU4Y2Y3ZS00ZjViLTRjOWUtOTg0Ni1jZGM0ZjgwOWZjYjOJAVnd6jnp/fQ/kAEAogEDQXNrqgE6IgNVU0QoBDIXQnJpdGlzaCBQb3VuZC9VUyBEb2xsYXJCEEFsbG93RGVjaW1hbFBpcHNqBkdCUFVTRLEBXqJ6a2CrvD+6ARASDkdvb2RUaWxsQ2FuY2VswgEUEgpJbnRlciBCYW5rGgRTQkZYIAHZAVnd6jnp/fQ/4gEFTGltaXTyAQhRdWFudGl0eYICClN0YW5kQWxvbmWKAgwI/cGL0AUQgNiMhQORAjMzMzMzM/M/GCOqAgdXb3JraW5n4AIfGin6AQg1MTM5NDMzNYkBFYxK6gQcM0CxAU0VjErqBLw/2QEVjErqBBwzQBoL+gEINTEzOTQzMzMaKfoBCDUxMzk0MzMyiQEeFmpN847yP7EBOPjCZKpglD/ZAR4Wak3zjvI/Ggv6AQg1MTM3NTc4Ng==';

export const orderSchema = `
        syntax = "proto3"; 
        option saxobank_root = "CollectionEnvelope";
        import "google/protobuf/timestamp.proto";
    
        message Guid {
           repeated int32 __meta_nulls = 1;
        }
        
        message InstrumentDisplayAndFormat {
           repeated int32 __meta_nulls = 1;
           int32 BarrierDecimals = 2;
           string BarrierFormat = 3;
           string Currency = 4;
           int32 Decimals = 5;
           string Description = 6;
           string DisplayHint = 7;
           string Format = 8;
           int32 NumeratorDecimals = 9;
           int32 OrderDecimals = 10;
           int32 StrikeDecimals = 11;
           string StrikeFormat = 12;
           string Symbol = 13;
        }
        
        message OrderDuration {
           repeated int32 __meta_nulls = 1;
           string DurationType = 2;
           .google.protobuf.Timestamp ExpirationDate = 3;
           bool ExpirationDateContainsTime = 4;
        }
        
        message InstrumentExchangeDetails {
           repeated int32 __meta_nulls = 1;
           string Description = 2;
           string ExchangeId = 3;
           bool IsOpen = 4;
        }
        
        message OrderOptionsData {
           repeated int32 __meta_nulls = 1;
           .google.protobuf.Timestamp ExpiryDate = 2;
           string PutCall = 3;
           double Strike = 4;
        }
        
        message RelatedOrderInfo {
           repeated int32 __meta_nulls = 1;
           bool __meta_deleted = 2;
           double Amount = 3;
           OrderDuration Duration = 4;
           string OpenOrderType = 5;
           string OrderId = 6;
           double OrderPrice = 7;
           double StopLimitPrice = 8;
           double TrailingStopDistanceToMarket = 9;
           double TrailingStopStep = 10;
        }
        
        message OrderResponse {
           repeated int32 __meta_nulls = 1;
           bool __meta_deleted = 2;
           repeated int32 __meta_empty = 3;
           string AccountId = 4;
           string AccountKey = 5;
           string AlgoStrategyName = 6;
           double Amount = 7;
           string AmountAccountValueRatio = 8;
           string AssetType = 9;
           string BuySell = 10;
           string CalculationReliability = 11;
           double CashAmount = 12;
           string ClientKey = 13;
           string CopiedPositionId = 14;
           Guid CorrelationKey = 15;
           string CorrelationTypes = 16;
           double CurrentPrice = 17;
           int32 CurrentPriceDelayMinutes = 18;
           .google.protobuf.Timestamp CurrentPriceLastTraded = 19;
           string CurrentPriceType = 20;
           InstrumentDisplayAndFormat DisplayAndFormat = 21;
           double DistanceToMarket = 22;
           OrderDuration Duration = 23;
           InstrumentExchangeDetails Exchange = 24;
           .google.protobuf.Timestamp ExpiryDate = 25;
           double FilledAmount = 26;
           double MarketPrice = 27;
           string OpenOrderType = 28;
           OrderOptionsData OptionsData = 29;
           string OrderAmountType = 30;
           string OrderId = 31;
           string OrderRelation = 32;
           .google.protobuf.Timestamp OrderTime = 33;
           double Price = 34;
           repeated RelatedOrderInfo RelatedOpenOrders = 35;
           string RelatedPositionId = 36;
           string Status = 37;
           double StopLimitPrice = 38;
           int32 SwitchInstrumentUic = 39;
           string ToOpenClose = 40;
           string TradeIdeaId = 41;
           double TrailingStopDistanceToMarket = 42;
           double TrailingStopStep = 43;
           int32 Uic = 44;
           .google.protobuf.Timestamp ValueDate = 45;
        }
        
        message CollectionEnvelope {
           repeated int32 __meta_nulls = 1;
           repeated int32 __meta_empty = 2;
           repeated OrderResponse Collection = 3;
        }
`;
