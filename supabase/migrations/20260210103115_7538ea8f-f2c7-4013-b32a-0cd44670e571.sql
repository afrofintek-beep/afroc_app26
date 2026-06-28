
-- Insert temp_address_manager role
INSERT INTO public.roles (name, description)
VALUES ('temp_address_manager', 'Gestor de endereços temporários — pode atribuir, suspender e reativar códigos AFROLOC temporários com validade configurável')
ON CONFLICT (name) DO NOTHING;
