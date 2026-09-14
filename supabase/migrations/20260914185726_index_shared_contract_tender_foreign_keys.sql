-- Cover both columns of the composite foreign keys for parent delete/update checks.
CREATE INDEX contract_bid_links_bid_category_idx ON public.contract_bid_links(bid_id, category_id);
CREATE INDEX contract_bid_links_category_project_idx ON public.contract_bid_links(category_id, project_id);
