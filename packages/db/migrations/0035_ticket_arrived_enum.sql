-- 0035 ticket arrived enum
-- The safe arrival moment (batch V3): a rider taps "I have arrived" and the
-- ticket's event stream records it. New enum values cannot be used in the
-- same transaction that adds them, so this step stands alone and 0036 uses
-- it (the 0010/0011 enum split law).

alter type public.ticket_event_type add value if not exists 'arrived';
