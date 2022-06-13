export const ACTION_SUBSCRIBE = 0x1 as const;
export const ACTION_UNSUBSCRIBE = 0x2 as const;
export const ACTION_MODIFY_PATCH = 0x8 as const;
export const ACTION_MODIFY_REPLACE = 0x10 as const;
export const ACTION_UNSUBSCRIBE_BY_TAG_PENDING = 0x20 as const;
export const ACTION_REMOVE = 0x40 as const;

export type SubscriptionAction =
    | typeof ACTION_SUBSCRIBE
    | typeof ACTION_UNSUBSCRIBE
    | typeof ACTION_MODIFY_PATCH
    | typeof ACTION_MODIFY_REPLACE
    | typeof ACTION_UNSUBSCRIBE_BY_TAG_PENDING
    | typeof ACTION_REMOVE;
