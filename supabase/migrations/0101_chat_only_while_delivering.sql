-- Customer <-> rider chat is only for the live delivery (like Amazon / Noon):
-- open from the moment a rider is assigned until the order is delivered or
-- cancelled. After that nobody can send; the page also hides the box.
-- Restrictive, so it narrows the existing "order participants send messages"
-- policy rather than replacing it. Admins are not affected (they cannot send
-- anyway: the base policy only lets the order owner or the assigned rider).

drop policy if exists chat_only_while_delivering on order_messages;
create policy chat_only_while_delivering on order_messages
  as restrictive for insert
  with check (
    exists (
      select 1 from orders o
      where o.id = order_messages.order_id
        and o.status in ('rider_assigned', 'out_for_delivery')
    )
  );
