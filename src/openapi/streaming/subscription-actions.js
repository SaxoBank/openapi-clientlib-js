export const ACTION_SUBSCRIBE = 0x1;
export const ACTION_UNSUBSCRIBE = 0x2;
export const ACTION_MODIFY = 0x4;

// Subscrtiption action variant that drives queue merging logic for subscription modification.
// Whenever ACTION_UNSUBSCRIBE is followed by ACTION_MODIFY_SUBSCRIBE, both actions will be kept.
// However if ACTION_UNSUBSCRIBE is followed by ACTION_SUBSCRIBE, we drop ACTION_UNSUBSCRIBE.
// Above cases only matter in context of pending actions queue.
export const ACTION_MODIFY_SUBSCRIBE = ACTION_SUBSCRIBE | ACTION_MODIFY;
