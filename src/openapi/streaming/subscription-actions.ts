export const ACTION_SUBSCRIBE = 0x1 as const;
export const ACTION_UNSUBSCRIBE = 0x2 as const;
export const ACTION_MODIFY = 0x4 as const;
export const ACTION_MODIFY_PATCH = 0x8 as const;
export const ACTION_UNSUBSCRIBE_BY_TAG_PENDING = 0x10 as const;

export type SubscriptionAction =
    | typeof ACTION_SUBSCRIBE
    | typeof ACTION_UNSUBSCRIBE
    | typeof ACTION_MODIFY
    | typeof ACTION_MODIFY_PATCH
    | typeof ACTION_UNSUBSCRIBE_BY_TAG_PENDING;
