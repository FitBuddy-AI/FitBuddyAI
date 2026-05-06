-- Atomic shop purchase helper used by the server-side buy route.

begin;

create or replace function public.buy_shop_item_atomic(p_user_id uuid, p_item jsonb)
returns public.fitbuddyai_userdata
language plpgsql
as $$
declare
  user_row public.fitbuddyai_userdata%rowtype;
  item_price integer;
  item_id text;
  item_quantity integer;
  inventory_items jsonb;
  merged_inventory jsonb := '[]'::jsonb;
  item_payload jsonb;
  existing_item jsonb;
  found_streak_saver boolean := false;
  existing_quantity integer;
begin
  item_price := greatest(coalesce(nullif(p_item->>'price', '')::integer, 0), 0);
  item_id := coalesce(p_item->>'id', '');
  item_quantity := greatest(coalesce(nullif(p_item->>'quantity', '')::integer, nullif(p_item->>'count', '')::integer, 1), 1);

  select *
    into user_row
    from public.fitbuddyai_userdata
   where user_id = p_user_id
   for update;

  if not found then
    raise exception 'User not found';
  end if;

  if coalesce(user_row.energy, 0) < item_price then
    raise exception 'Insufficient energy';
  end if;

  inventory_items := coalesce(user_row.inventory, '[]'::jsonb);
  item_payload := p_item || jsonb_build_object('price', item_price, 'purchased_at', now()::text);

  if item_id like 'streak-saver%' then
    for existing_item in select value from jsonb_array_elements(inventory_items) as value loop
      if not found_streak_saver and coalesce(existing_item->>'id', '') like 'streak-saver%' then
        existing_quantity := greatest(coalesce(nullif(existing_item->>'quantity', '')::integer, nullif(existing_item->>'count', '')::integer, 1), 1);
        merged_inventory := merged_inventory || jsonb_build_array(
          existing_item || jsonb_build_object(
            'quantity', existing_quantity + item_quantity,
            'price', item_price,
            'purchased_at', now()::text
          )
        );
        found_streak_saver := true;
      else
        merged_inventory := merged_inventory || jsonb_build_array(existing_item);
      end if;
    end loop;

    if not found_streak_saver then
      merged_inventory := merged_inventory || jsonb_build_array(item_payload || jsonb_build_object('quantity', item_quantity));
    end if;
  else
    merged_inventory := inventory_items || jsonb_build_array(item_payload);
  end if;

  update public.fitbuddyai_userdata
     set energy = user_row.energy - item_price,
         inventory = merged_inventory,
         updated_at = now()
   where user_id = p_user_id
   returning * into user_row;

  return user_row;
end;
$$;

commit;