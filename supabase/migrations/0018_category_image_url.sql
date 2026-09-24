-- Category tile photos were hardcoded per-slug in src/lib/categoryTheme.ts,
-- invisible to admins and impossible to edit without a code change. Moving
-- them into the DB (and backfilling the 9 existing categories with the same
-- photos already live on the homepage) so admins can see and update them.
alter table categories add column image_url text;

update categories set image_url = case slug
  when 'fresh' then 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Liat_Portal_for_Foodie_Disorder_-_Fresh_spinach_leaves.jpg/250px-Liat_Portal_for_Foodie_Disorder_-_Fresh_spinach_leaves.jpg'
  when 'fruits' then 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/A_vibrant_assortment_of_fresh_fruits.jpg/250px-A_vibrant_assortment_of_fresh_fruits.jpg'
  when 'vegetables' then 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/A_woven_basket_filled_with_an_assortment_of_colorful_vegetables.jpg/250px-A_woven_basket_filled_with_an_assortment_of_colorful_vegetables.jpg'
  when 'grocery' then 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Faced_products_on_a_supermarket_shelf.JPG/250px-Faced_products_on_a_supermarket_shelf.JPG'
  when 'dairy' then 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/%D0%A0%D1%96%D0%B7%D0%BD%D1%96_%D0%B2%D0%B8%D0%B4%D0%B8_%D0%BC%D0%BE%D0%BB%D0%BE%D1%87%D0%BD%D0%B8%D1%85_%D0%BF%D1%80%D0%BE%D0%B4%D1%83%D0%BA%D1%82%D1%96%D0%B2_%D1%83%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D1%81%D1%8C%D0%BA%D0%BE%D0%B3%D0%BE_%D0%B2%D0%B8%D1%80%D0%BE%D0%B1%D0%BD%D0%B8%D1%86%D1%82%D0%B2%D0%B0.jpg/250px-thumbnail.jpg'
  when 'meat' then 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d2/Fresh_Meat_Cuts_at_Market.jpg/250px-Fresh_Meat_Cuts_at_Market.jpg'
  when 'bakery' then 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/88/MALTESE_BREAD_%282977855466%29.jpg/250px-MALTESE_BREAD_%282977855466%29.jpg'
  when 'beverages' then 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2a/Soft_drink_shelf.JPG/250px-Soft_drink_shelf.JPG'
  when 'household' then 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Pirna_DDR_Museum_Waschmittel_Reiniger_Sprays.jpg/250px-Pirna_DDR_Museum_Waschmittel_Reiniger_Sprays.jpg'
  else image_url
end
where slug in ('fresh', 'fruits', 'vegetables', 'grocery', 'dairy', 'meat', 'bakery', 'beverages', 'household');
