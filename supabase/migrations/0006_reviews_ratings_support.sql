-- Support product ratings/reviews display.
-- reviewer_name is denormalized at insert time (rather than joining profiles)
-- so the public review list doesn't need a broad "profiles are publicly
-- readable" policy that would also leak phone numbers.
alter table reviews add column reviewer_name text;

create view product_ratings
with (security_invoker = true) as
select
  product_id,
  round(avg(rating)::numeric, 1) as avg_rating,
  count(*) as review_count
from reviews
group by product_id;

create index reviews_product_idx on reviews(product_id);
