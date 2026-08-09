update public.subscription_features
set name = case key
  when 'excel_unlocker' then 'Excel – odemčení'
  when 'excel_merger' then 'Excel Spojení listů'
  when 'excel_indexer' then 'Excel Indexace VŘ'
  else name
end
where key in ('excel_unlocker', 'excel_merger', 'excel_indexer');
