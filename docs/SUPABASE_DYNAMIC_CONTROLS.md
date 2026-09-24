# Controles dinámicos y roles

Aplica `supabase/migrations/202609241345_dynamic_controls_and_roles.sql` desde el SQL Editor de Supabase antes de desplegar esta versión.

La migración conserva los controles existentes, elimina el límite de un control por horario y agrega roles para los usuarios autenticados.

Después de crear los usuarios en Supabase Auth, asigna un rol a cada uno. Reemplaza los UUID por los valores reales de Auth:

```sql
insert into public.user_roles (user_id, role)
values
  ('UUID_DEL_ADMIN', 'admin'),
  ('UUID_DEL_REPORTERO', 'reporter')
on conflict (user_id) do update
set role = excluded.role,
    updated_at = now();
```

Obtén los UUID desde Authentication > Users o con esta consulta en el SQL Editor:

```sql
select id, email
from auth.users
order by created_at;
```

El usuario debe cerrar e iniciar sesión después de asignar o cambiar su rol.

Permisos:

- `admin`: administra viajes, registra controles y puede corregir cualquier control, incluida la fecha y hora de llegada.
- `reporter`: consulta viajes y controles, y solo registra nuevas llegadas. La base de datos asigna la hora actual al reporte y bloquea actualizaciones posteriores.
- Ninguno de los dos roles puede eliminar viajes ni controles.
