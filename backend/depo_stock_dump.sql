--
-- PostgreSQL database dump
--

\restrict NXxGBgubRcTrJZYc7BET0QoxP1BXdJ1D2TOFQBOOvSYENvwbSqMTK7ZgGbky5dh

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: estado_tramite; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_tramite AS ENUM (
    'pendiente',
    'en_revision',
    'aprobado_parcial',
    'aprobado',
    'rechazado',
    'finalizado'
);


--
-- Name: tipo_bien; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_bien AS ENUM (
    'consumible',
    'patrimonial'
);


--
-- Name: tipo_movimiento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_movimiento AS ENUM (
    'ingreso',
    'egreso',
    'ajuste',
    'devolucion'
);


--
-- Name: fn_apply_stock_delta(integer, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_apply_stock_delta(p_producto_id integer, p_tipo text, p_cantidad integer, p_factor integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF p_producto_id IS NULL OR COALESCE(p_cantidad, 0) = 0 THEN
    RETURN;
  END IF;

  CASE LOWER(COALESCE(p_tipo, ''))
    WHEN 'ingreso' THEN
      UPDATE producto
      SET stock_actual = COALESCE(stock_actual, 0) + (COALESCE(p_cantidad, 0) * p_factor)
      WHERE id_producto = p_producto_id;
    WHEN 'devolucion' THEN
      UPDATE producto
      SET stock_actual = COALESCE(stock_actual, 0) + (COALESCE(p_cantidad, 0) * p_factor)
      WHERE id_producto = p_producto_id;
    WHEN 'egreso' THEN
      UPDATE producto
      SET stock_actual = COALESCE(stock_actual, 0) - (COALESCE(p_cantidad, 0) * p_factor)
      WHERE id_producto = p_producto_id;
    WHEN 'salida' THEN
      UPDATE producto
      SET stock_actual = COALESCE(stock_actual, 0) - (COALESCE(p_cantidad, 0) * p_factor)
      WHERE id_producto = p_producto_id;
    ELSE
      NULL;
  END CASE;
END;
$$;


--
-- Name: fn_producto_defaults_compat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_producto_defaults_compat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.codigo IS NULL OR BTRIM(COALESCE(NEW.codigo, '')) = '' THEN
    NEW.codigo := NEW.nombre;
  END IF;

  IF NEW.tipo IS NULL OR BTRIM(COALESCE(NEW.tipo, '')) = '' THEN
    NEW.tipo := 'Insumos';
  END IF;

  IF NEW.stock_actual IS NULL THEN
    NEW.stock_actual := 0;
  END IF;

  IF NEW.stock_minimo IS NULL THEN
    NEW.stock_minimo := 0;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: fn_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


--
-- Name: fn_sync_legacy_movimientos_to_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sync_legacy_movimientos_to_stock() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_tipo tipo_movimiento;
  v_institucion_id INT;
  v_cue VARCHAR(20);
BEGIN
  v_cue := NULLIF(REGEXP_REPLACE(COALESCE(NEW.cue, ''), '\\D', '', 'g'), '');

  IF v_cue IS NOT NULL THEN
    SELECT id_institucion
      INTO v_institucion_id
    FROM institucion
    WHERE cue = v_cue
    ORDER BY activo DESC NULLS LAST, id_institucion
    LIMIT 1;
  END IF;

  v_tipo := CASE LOWER(COALESCE(NEW.tipo, ''))
    WHEN 'salida' THEN 'egreso'::tipo_movimiento
    WHEN 'egreso' THEN 'egreso'::tipo_movimiento
    WHEN 'entrada' THEN 'ingreso'::tipo_movimiento
    WHEN 'ingreso' THEN 'ingreso'::tipo_movimiento
    WHEN 'ajuste' THEN 'ajuste'::tipo_movimiento
    WHEN 'devolucion' THEN 'devolucion'::tipo_movimiento
    ELSE NULL
  END;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Tipo de movimiento no compatible en tabla legacy movimientos: %', NEW.tipo;
  END IF;

  -- El endpoint legacy ya ajusta el stock manualmente, por eso evitamos duplicarlo aquí.
  PERFORM set_config('depo.skip_stock_sync', 'on', true);

  INSERT INTO movimiento_stock (
    id_producto,
    cantidad,
    tipo,
    fecha_movimiento,
    id_usuario,
    motivo,
    id_institucion
  ) VALUES (
    NEW.producto_id,
    NEW.cantidad,
    v_tipo,
    COALESCE(NEW.created_at, NOW()),
    NEW.usuario_id,
    NULLIF(NEW.motivo, ''),
    v_institucion_id
  );

  RETURN NEW;
END;
$$;


--
-- Name: fn_sync_nivel_institucion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sync_nivel_institucion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.nivel_educativo IS NULL AND NEW.nivel IS NOT NULL THEN
    NEW.nivel_educativo := NEW.nivel;
  END IF;

  IF NEW.nivel IS NULL AND NEW.nivel_educativo IS NOT NULL THEN
    NEW.nivel := NEW.nivel_educativo;
  END IF;

  IF COALESCE(NULLIF(BTRIM(NEW.categoria), ''), NULL) IS NULL
     AND COALESCE(NULLIF(BTRIM(NEW.tipo), ''), NULL) IS NOT NULL THEN
    NEW.categoria := NEW.tipo;
  END IF;

  IF COALESCE(NULLIF(BTRIM(NEW.tipo), ''), NULL) IS NULL
     AND COALESCE(NULLIF(BTRIM(NEW.categoria), ''), NULL) IS NOT NULL THEN
    NEW.tipo := NEW.categoria;
  END IF;

  IF NEW.activo IS NULL THEN
    NEW.activo := TRUE;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: fn_sync_stock_from_movimiento_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sync_stock_from_movimiento_stock() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF current_setting('depo.skip_stock_sync', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM fn_apply_stock_delta(NEW.id_producto, NEW.tipo::text, NEW.cantidad, 1);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM fn_apply_stock_delta(OLD.id_producto, OLD.tipo::text, OLD.cantidad, -1);
    PERFORM fn_apply_stock_delta(NEW.id_producto, NEW.tipo::text, NEW.cantidad, 1);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM fn_apply_stock_delta(OLD.id_producto, OLD.tipo::text, OLD.cantidad, -1);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ajustes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ajustes (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad_anterior integer NOT NULL,
    cantidad_nueva integer NOT NULL,
    motivo text NOT NULL,
    usuario_id integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: ajustes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ajustes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ajustes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ajustes_id_seq OWNED BY public.ajustes.id;


--
-- Name: aprobacion_seguimiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aprobacion_seguimiento (
    id_aprobacion integer NOT NULL,
    id_pedido integer,
    id_rol_interviniente integer,
    id_usuario_firma integer,
    estado_resultante public.estado_tramite,
    observacion text,
    fecha_firma timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: aprobacion_seguimiento_id_aprobacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.aprobacion_seguimiento_id_aprobacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: aprobacion_seguimiento_id_aprobacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.aprobacion_seguimiento_id_aprobacion_seq OWNED BY public.aprobacion_seguimiento.id_aprobacion;


--
-- Name: asignaciones_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asignaciones_stock (
    id integer NOT NULL,
    institucion_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad_asignada integer DEFAULT 0 NOT NULL,
    cantidad_entregada integer DEFAULT 0 NOT NULL,
    periodo character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: asignaciones_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asignaciones_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asignaciones_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asignaciones_stock_id_seq OWNED BY public.asignaciones_stock.id;


--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    id integer NOT NULL,
    usuario_id integer,
    entidad character varying(100) NOT NULL,
    accion character varying(100) NOT NULL,
    id_registro integer,
    cambios jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_id_seq OWNED BY public.auditoria.id;


--
-- Name: categoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categoria (
    id_categoria integer NOT NULL,
    nombre character varying(50),
    tipo_bien public.tipo_bien DEFAULT 'consumible'::public.tipo_bien
);


--
-- Name: categoria_id_categoria_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categoria_id_categoria_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categoria_id_categoria_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categoria_id_categoria_seq OWNED BY public.categoria.id_categoria;


--
-- Name: detalle_ingreso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detalle_ingreso (
    id_detalle_ingreso integer NOT NULL,
    id_ingreso integer,
    id_producto integer,
    cantidad_recibida integer NOT NULL,
    CONSTRAINT detalle_ingreso_cantidad_recibida_check CHECK ((cantidad_recibida > 0))
);


--
-- Name: detalle_ingreso_id_detalle_ingreso_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.detalle_ingreso_id_detalle_ingreso_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: detalle_ingreso_id_detalle_ingreso_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.detalle_ingreso_id_detalle_ingreso_seq OWNED BY public.detalle_ingreso.id_detalle_ingreso;


--
-- Name: detalle_orden; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detalle_orden (
    id_detalle_orden integer NOT NULL,
    id_orden integer,
    id_producto integer,
    cantidad_entregada integer NOT NULL,
    CONSTRAINT detalle_orden_cantidad_entregada_check CHECK ((cantidad_entregada > 0))
);


--
-- Name: detalle_orden_id_detalle_orden_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.detalle_orden_id_detalle_orden_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: detalle_orden_id_detalle_orden_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.detalle_orden_id_detalle_orden_seq OWNED BY public.detalle_orden.id_detalle_orden;


--
-- Name: detalle_pedido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detalle_pedido (
    id_detalle_pedido integer NOT NULL,
    id_pedido integer,
    id_producto integer,
    cantidad_solicitada integer NOT NULL,
    observacion text,
    CONSTRAINT detalle_pedido_cantidad_solicitada_check CHECK ((cantidad_solicitada > 0))
);


--
-- Name: detalle_pedido_id_detalle_pedido_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.detalle_pedido_id_detalle_pedido_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: detalle_pedido_id_detalle_pedido_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.detalle_pedido_id_detalle_pedido_seq OWNED BY public.detalle_pedido.id_detalle_pedido;


--
-- Name: direccion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.direccion (
    id_direccion integer NOT NULL,
    calle character varying(150),
    numero_puerta character varying(20),
    localidad character varying(100),
    departamento character varying(100),
    codigo_postal integer,
    latitud numeric,
    longitud numeric,
    te_voip character varying(30),
    letra_zona character varying(5)
);


--
-- Name: direccion_id_direccion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.direccion_id_direccion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: direccion_id_direccion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.direccion_id_direccion_seq OWNED BY public.direccion.id_direccion;


--
-- Name: edificio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edificio (
    id_edificio integer NOT NULL,
    cui character varying(20),
    calle character varying(50),
    numero_puerta character varying(20),
    direccion character varying(100),
    localidad character varying(50),
    departamento character varying(50),
    codigo_postal integer,
    latitud numeric,
    longitud numeric,
    te_voip character varying(30),
    letra_zona character varying(5),
    id_direccion integer
);


--
-- Name: edificio_id_edificio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.edificio_id_edificio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: edificio_id_edificio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.edificio_id_edificio_seq OWNED BY public.edificio.id_edificio;


--
-- Name: ingreso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingreso (
    id_ingreso integer NOT NULL,
    fecha_recepcion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    id_proveedor integer,
    id_licitacion integer,
    id_usuario_receptor integer
);


--
-- Name: ingreso_id_ingreso_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingreso_id_ingreso_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingreso_id_ingreso_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingreso_id_ingreso_seq OWNED BY public.ingreso.id_ingreso;


--
-- Name: institucion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institucion (
    id_institucion integer NOT NULL,
    nombre character varying(100) NOT NULL,
    cue character varying(20),
    id_edificio integer,
    establecimiento_cabecera character varying(100),
    nivel_educativo character varying(50),
    categoria character varying(20),
    ambito character varying(20),
    activo boolean DEFAULT true,
    nivel character varying(50),
    tipo character varying(20),
    email character varying(120),
    telefono character varying(50),
    matriculados integer DEFAULT 0,
    factor_asignacion numeric(10,2) DEFAULT 1.0,
    notas text,
    limite_productos character varying(1000),
    direccion character varying(200),
    localidad character varying(100),
    departamento character varying(100),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: institucion_id_institucion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.institucion_id_institucion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: institucion_id_institucion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.institucion_id_institucion_seq OWNED BY public.institucion.id_institucion;


--
-- Name: instituciones; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.instituciones AS
 SELECT id_institucion AS id,
    cue,
    nombre,
    nivel_educativo,
    nivel,
    tipo,
    matriculados,
    factor_asignacion,
    activo
   FROM public.institucion i;


--
-- Name: licitacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.licitacion (
    id_licitacion integer NOT NULL,
    nro_expediente character varying(50),
    fecha_apertura date,
    objeto text
);


--
-- Name: licitacion_id_licitacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.licitacion_id_licitacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: licitacion_id_licitacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.licitacion_id_licitacion_seq OWNED BY public.licitacion.id_licitacion;


--
-- Name: movimiento_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimiento_stock (
    id_movimiento integer NOT NULL,
    id_producto integer,
    cantidad integer NOT NULL,
    tipo public.tipo_movimiento,
    id_detalle_ingreso integer,
    id_detalle_orden integer,
    fecha_movimiento timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    id_proveedor integer,
    estado_producto character varying(50),
    cargo_retira character varying(50),
    id_institucion integer,
    id_usuario integer,
    motivo text,
    CONSTRAINT chk_movimiento_origen CHECK ((((id_detalle_ingreso IS NOT NULL) AND (id_detalle_orden IS NULL)) OR ((id_detalle_ingreso IS NULL) AND (id_detalle_orden IS NOT NULL)) OR ((id_detalle_ingreso IS NULL) AND (id_detalle_orden IS NULL))))
);


--
-- Name: movimiento_stock_id_movimiento_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movimiento_stock_id_movimiento_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimiento_stock_id_movimiento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.movimiento_stock_id_movimiento_seq OWNED BY public.movimiento_stock.id_movimiento;


--
-- Name: movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimientos (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    tipo character varying(30) NOT NULL,
    cantidad integer NOT NULL,
    usuario_id integer,
    motivo text,
    cue character varying(20),
    pedido_id integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT movimientos_cantidad_check CHECK ((cantidad > 0))
);


--
-- Name: movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.movimientos_id_seq OWNED BY public.movimientos.id;


--
-- Name: orden_dispensacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orden_dispensacion (
    id_orden integer NOT NULL,
    id_pedido integer,
    id_usuario_despacha integer,
    id_institucion integer,
    fecha_despacho timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    estado public.estado_tramite DEFAULT 'pendiente'::public.estado_tramite
);


--
-- Name: orden_dispensacion_id_orden_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orden_dispensacion_id_orden_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orden_dispensacion_id_orden_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orden_dispensacion_id_orden_seq OWNED BY public.orden_dispensacion.id_orden;


--
-- Name: pedido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedido (
    id_pedido integer NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    estado public.estado_tramite DEFAULT 'pendiente'::public.estado_tramite,
    id_usuario_solicitante integer,
    id_institucion integer,
    observaciones_generales text
);


--
-- Name: pedido_id_pedido_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedido_id_pedido_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedido_id_pedido_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pedido_id_pedido_seq OWNED BY public.pedido.id_pedido;


--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad integer NOT NULL,
    institucion character varying(255),
    estado character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    notas text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT pedidos_cantidad_check CHECK ((cantidad > 0))
);


--
-- Name: pedidos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedidos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedidos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pedidos_id_seq OWNED BY public.pedidos.id;


--
-- Name: permiso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permiso (
    id_permiso integer NOT NULL,
    codigo character varying(120) NOT NULL,
    descripcion character varying(255)
);


--
-- Name: permiso_id_permiso_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permiso_id_permiso_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permiso_id_permiso_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permiso_id_permiso_seq OWNED BY public.permiso.id_permiso;


--
-- Name: producto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producto (
    id_producto integer NOT NULL,
    nombre character varying(100),
    unidad_medida character varying(20),
    stock_minimo integer DEFAULT 0,
    id_categoria integer,
    stock_actual integer DEFAULT 0,
    codigo character varying(50),
    tipo character varying(50) DEFAULT 'Insumos'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT producto_stock_minimo_check CHECK ((stock_minimo >= 0))
);


--
-- Name: producto_id_producto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.producto_id_producto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: producto_id_producto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.producto_id_producto_seq OWNED BY public.producto.id_producto;


--
-- Name: productos; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.productos AS
 SELECT id_producto AS id,
    codigo,
    nombre,
    unidad_medida,
    stock_actual,
    stock_minimo,
    id_categoria,
    tipo,
    created_at,
    updated_at
   FROM public.producto p;


--
-- Name: proveedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedor (
    id_proveedor integer NOT NULL,
    nombre character varying(100),
    cuit character varying(20),
    contacto character varying(100),
    telefono character varying(30),
    email character varying(120),
    categoria character varying(50),
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: proveedor_id_proveedor_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.proveedor_id_proveedor_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: proveedor_id_proveedor_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.proveedor_id_proveedor_seq OWNED BY public.proveedor.id_proveedor;


--
-- Name: rol; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rol (
    id_rol integer NOT NULL,
    nombre character varying(50)
);


--
-- Name: rol_id_rol_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rol_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rol_id_rol_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rol_id_rol_seq OWNED BY public.rol.id_rol;


--
-- Name: rol_permiso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rol_permiso (
    id_rol integer NOT NULL,
    id_permiso integer NOT NULL
);


--
-- Name: usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario (
    id_usuario integer NOT NULL,
    nombre character varying(50),
    apellido character varying(50),
    dni character varying(20),
    email character varying(100),
    password character varying(255),
    telefono character varying(20),
    id_institucion integer,
    role character varying(50),
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.users AS
 SELECT u.id_usuario AS id,
    u.nombre,
    u.apellido,
    u.email,
    u.dni,
    u.password,
    u.telefono,
    u.role,
    u.activo,
    u.created_at,
    u.id_institucion,
    i.nombre AS institucion
   FROM (public.usuario u
     LEFT JOIN public.institucion i ON ((i.id_institucion = u.id_institucion)));


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_id_usuario_seq OWNED BY public.usuario.id_usuario;


--
-- Name: usuario_rol; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_rol (
    id_usuario integer NOT NULL,
    id_rol integer NOT NULL
);


--
-- Name: ajustes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ajustes ALTER COLUMN id SET DEFAULT nextval('public.ajustes_id_seq'::regclass);


--
-- Name: aprobacion_seguimiento id_aprobacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aprobacion_seguimiento ALTER COLUMN id_aprobacion SET DEFAULT nextval('public.aprobacion_seguimiento_id_aprobacion_seq'::regclass);


--
-- Name: asignaciones_stock id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignaciones_stock ALTER COLUMN id SET DEFAULT nextval('public.asignaciones_stock_id_seq'::regclass);


--
-- Name: auditoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria ALTER COLUMN id SET DEFAULT nextval('public.auditoria_id_seq'::regclass);


--
-- Name: categoria id_categoria; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categoria ALTER COLUMN id_categoria SET DEFAULT nextval('public.categoria_id_categoria_seq'::regclass);


--
-- Name: detalle_ingreso id_detalle_ingreso; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_ingreso ALTER COLUMN id_detalle_ingreso SET DEFAULT nextval('public.detalle_ingreso_id_detalle_ingreso_seq'::regclass);


--
-- Name: detalle_orden id_detalle_orden; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_orden ALTER COLUMN id_detalle_orden SET DEFAULT nextval('public.detalle_orden_id_detalle_orden_seq'::regclass);


--
-- Name: detalle_pedido id_detalle_pedido; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedido ALTER COLUMN id_detalle_pedido SET DEFAULT nextval('public.detalle_pedido_id_detalle_pedido_seq'::regclass);


--
-- Name: direccion id_direccion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direccion ALTER COLUMN id_direccion SET DEFAULT nextval('public.direccion_id_direccion_seq'::regclass);


--
-- Name: edificio id_edificio; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edificio ALTER COLUMN id_edificio SET DEFAULT nextval('public.edificio_id_edificio_seq'::regclass);


--
-- Name: ingreso id_ingreso; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingreso ALTER COLUMN id_ingreso SET DEFAULT nextval('public.ingreso_id_ingreso_seq'::regclass);


--
-- Name: institucion id_institucion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institucion ALTER COLUMN id_institucion SET DEFAULT nextval('public.institucion_id_institucion_seq'::regclass);


--
-- Name: licitacion id_licitacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitacion ALTER COLUMN id_licitacion SET DEFAULT nextval('public.licitacion_id_licitacion_seq'::regclass);


--
-- Name: movimiento_stock id_movimiento; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento_stock ALTER COLUMN id_movimiento SET DEFAULT nextval('public.movimiento_stock_id_movimiento_seq'::regclass);


--
-- Name: movimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos ALTER COLUMN id SET DEFAULT nextval('public.movimientos_id_seq'::regclass);


--
-- Name: orden_dispensacion id_orden; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_dispensacion ALTER COLUMN id_orden SET DEFAULT nextval('public.orden_dispensacion_id_orden_seq'::regclass);


--
-- Name: pedido id_pedido; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido ALTER COLUMN id_pedido SET DEFAULT nextval('public.pedido_id_pedido_seq'::regclass);


--
-- Name: pedidos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos ALTER COLUMN id SET DEFAULT nextval('public.pedidos_id_seq'::regclass);


--
-- Name: permiso id_permiso; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permiso ALTER COLUMN id_permiso SET DEFAULT nextval('public.permiso_id_permiso_seq'::regclass);


--
-- Name: producto id_producto; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto ALTER COLUMN id_producto SET DEFAULT nextval('public.producto_id_producto_seq'::regclass);


--
-- Name: proveedor id_proveedor; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor ALTER COLUMN id_proveedor SET DEFAULT nextval('public.proveedor_id_proveedor_seq'::regclass);


--
-- Name: rol id_rol; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol ALTER COLUMN id_rol SET DEFAULT nextval('public.rol_id_rol_seq'::regclass);


--
-- Name: usuario id_usuario; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuario_id_usuario_seq'::regclass);


--
-- Data for Name: ajustes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ajustes (id, producto_id, cantidad_anterior, cantidad_nueva, motivo, usuario_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: aprobacion_seguimiento; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.aprobacion_seguimiento (id_aprobacion, id_pedido, id_rol_interviniente, id_usuario_firma, estado_resultante, observacion, fecha_firma) FROM stdin;
\.


--
-- Data for Name: asignaciones_stock; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.asignaciones_stock (id, institucion_id, producto_id, cantidad_asignada, cantidad_entregada, periodo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: auditoria; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auditoria (id, usuario_id, entidad, accion, id_registro, cambios, created_at) FROM stdin;
\.


--
-- Data for Name: categoria; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categoria (id_categoria, nombre, tipo_bien) FROM stdin;
1	Insumos de limpieza	consumible
2	Papelería/Librería	consumible
3	Otros	consumible
\.


--
-- Data for Name: detalle_ingreso; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.detalle_ingreso (id_detalle_ingreso, id_ingreso, id_producto, cantidad_recibida) FROM stdin;
\.


--
-- Data for Name: detalle_orden; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.detalle_orden (id_detalle_orden, id_orden, id_producto, cantidad_entregada) FROM stdin;
\.


--
-- Data for Name: detalle_pedido; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.detalle_pedido (id_detalle_pedido, id_pedido, id_producto, cantidad_solicitada, observacion) FROM stdin;
\.


--
-- Data for Name: direccion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.direccion (id_direccion, calle, numero_puerta, localidad, departamento, codigo_postal, latitud, longitud, te_voip, letra_zona) FROM stdin;
\.


--
-- Data for Name: edificio; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.edificio (id_edificio, cui, calle, numero_puerta, direccion, localidad, departamento, codigo_postal, latitud, longitud, te_voip, letra_zona, id_direccion) FROM stdin;
\.


--
-- Data for Name: ingreso; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ingreso (id_ingreso, fecha_recepcion, id_proveedor, id_licitacion, id_usuario_receptor) FROM stdin;
\.


--
-- Data for Name: institucion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.institucion (id_institucion, nombre, cue, id_edificio, establecimiento_cabecera, nivel_educativo, categoria, ambito, activo, nivel, tipo, email, telefono, matriculados, factor_asignacion, notas, limite_productos, direccion, localidad, departamento, updated_at) FROM stdin;
\.


--
-- Data for Name: licitacion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.licitacion (id_licitacion, nro_expediente, fecha_apertura, objeto) FROM stdin;
\.


--
-- Data for Name: movimiento_stock; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.movimiento_stock (id_movimiento, id_producto, cantidad, tipo, id_detalle_ingreso, id_detalle_orden, fecha_movimiento, id_proveedor, estado_producto, cargo_retira, id_institucion, id_usuario, motivo) FROM stdin;
\.


--
-- Data for Name: movimientos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.movimientos (id, producto_id, tipo, cantidad, usuario_id, motivo, cue, pedido_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: orden_dispensacion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orden_dispensacion (id_orden, id_pedido, id_usuario_despacha, id_institucion, fecha_despacho, estado) FROM stdin;
\.


--
-- Data for Name: pedido; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pedido (id_pedido, fecha_creacion, estado, id_usuario_solicitante, id_institucion, observaciones_generales) FROM stdin;
\.


--
-- Data for Name: pedidos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pedidos (id, usuario_id, producto_id, cantidad, institucion, estado, notas, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: permiso; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permiso (id_permiso, codigo, descripcion) FROM stdin;
1	dashboard.view	dashboard.view
2	stock.view	stock.view
3	stock.edit	stock.edit
4	stock.movement.create	stock.movement.create
5	users.read	users.read
6	users.create	users.create
7	users.role.update	users.role.update
8	users.status.update	users.status.update
9	users.delete	users.delete
10	productos.view	productos.view
11	productos.create	productos.create
12	productos.edit	productos.edit
13	productos.delete	productos.delete
14	movimientos.view	movimientos.view
15	movimientos.create	movimientos.create
16	ajustes.view	ajustes.view
17	ajustes.create	ajustes.create
18	auditoria.view	auditoria.view
19	pedidos.view	pedidos.view
20	pedidos.create	pedidos.create
21	pedidos.manage	pedidos.manage
22	supervision.manage	supervision.manage
23	supervision.reports.request	supervision.reports.request
24	instituciones.view	instituciones.view
25	instituciones.create	instituciones.create
26	instituciones.edit	instituciones.edit
27	instituciones.delete	instituciones.delete
28	instituciones.asignar	instituciones.asignar
29	proveedores.view	proveedores.view
30	proveedores.create	proveedores.create
31	proveedores.edit	proveedores.edit
32	proveedores.delete	proveedores.delete
33	limites.view	limites.view
34	limites.edit	limites.edit
\.


--
-- Data for Name: producto; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.producto (id_producto, nombre, unidad_medida, stock_minimo, id_categoria, stock_actual, codigo, tipo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: proveedor; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.proveedor (id_proveedor, nombre, cuit, contacto, telefono, email, categoria, activo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: rol; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rol (id_rol, nombre) FROM stdin;
1	admin
2	control_ministerio
3	directivo
4	supervisor
5	director_area
6	operador
7	consulta
8	auditor_externo
\.


--
-- Data for Name: rol_permiso; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rol_permiso (id_rol, id_permiso) FROM stdin;
1	1
1	2
1	3
1	4
1	5
1	6
1	7
1	8
1	9
1	10
1	11
1	12
1	13
1	14
1	15
1	16
1	17
1	18
1	19
1	21
1	24
1	25
1	26
1	27
1	28
1	29
1	30
1	31
1	32
1	33
1	34
2	1
2	2
2	10
2	14
2	18
2	19
2	21
2	24
2	28
2	33
2	34
3	1
3	10
3	19
3	20
3	18
4	1
4	19
4	21
4	24
5	1
5	5
5	24
5	22
5	23
6	1
6	2
6	3
6	4
6	10
6	11
6	12
6	14
6	15
6	16
6	17
6	18
6	29
6	30
6	31
6	32
7	1
7	2
7	10
7	14
7	16
7	18
8	1
8	10
\.


--
-- Data for Name: usuario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuario (id_usuario, nombre, apellido, dni, email, password, telefono, id_institucion, role, activo, created_at, updated_at) FROM stdin;
1	Administrador	Inicial	00000000	admin@depo.local	$2a$10$7v3mMWS0ZGnoKGAQMNVO/eJLrObTld1vZodGw2r8UriFLWs1pYSGK	\N	\N	admin	t	2026-03-31 11:10:34.652768	2026-03-31 11:10:34.652768
\.


--
-- Data for Name: usuario_rol; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuario_rol (id_usuario, id_rol) FROM stdin;
\.


--
-- Name: ajustes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ajustes_id_seq', 1, false);


--
-- Name: aprobacion_seguimiento_id_aprobacion_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.aprobacion_seguimiento_id_aprobacion_seq', 1, false);


--
-- Name: asignaciones_stock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.asignaciones_stock_id_seq', 1, false);


--
-- Name: auditoria_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auditoria_id_seq', 1, false);


--
-- Name: categoria_id_categoria_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categoria_id_categoria_seq', 3, true);


--
-- Name: detalle_ingreso_id_detalle_ingreso_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.detalle_ingreso_id_detalle_ingreso_seq', 1, false);


--
-- Name: detalle_orden_id_detalle_orden_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.detalle_orden_id_detalle_orden_seq', 1, false);


--
-- Name: detalle_pedido_id_detalle_pedido_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.detalle_pedido_id_detalle_pedido_seq', 1, false);


--
-- Name: direccion_id_direccion_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.direccion_id_direccion_seq', 1, false);


--
-- Name: edificio_id_edificio_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.edificio_id_edificio_seq', 1, false);


--
-- Name: ingreso_id_ingreso_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ingreso_id_ingreso_seq', 1, false);


--
-- Name: institucion_id_institucion_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.institucion_id_institucion_seq', 1, false);


--
-- Name: licitacion_id_licitacion_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.licitacion_id_licitacion_seq', 1, false);


--
-- Name: movimiento_stock_id_movimiento_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.movimiento_stock_id_movimiento_seq', 1, false);


--
-- Name: movimientos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.movimientos_id_seq', 1, false);


--
-- Name: orden_dispensacion_id_orden_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orden_dispensacion_id_orden_seq', 1, false);


--
-- Name: pedido_id_pedido_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pedido_id_pedido_seq', 1, false);


--
-- Name: pedidos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pedidos_id_seq', 1, false);


--
-- Name: permiso_id_permiso_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.permiso_id_permiso_seq', 34, true);


--
-- Name: producto_id_producto_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.producto_id_producto_seq', 1, true);


--
-- Name: proveedor_id_proveedor_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.proveedor_id_proveedor_seq', 1, false);


--
-- Name: rol_id_rol_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rol_id_rol_seq', 43, true);


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.usuario_id_usuario_seq', 1, true);


--
-- Name: ajustes ajustes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ajustes
    ADD CONSTRAINT ajustes_pkey PRIMARY KEY (id);


--
-- Name: aprobacion_seguimiento aprobacion_seguimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aprobacion_seguimiento
    ADD CONSTRAINT aprobacion_seguimiento_pkey PRIMARY KEY (id_aprobacion);


--
-- Name: asignaciones_stock asignaciones_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignaciones_stock
    ADD CONSTRAINT asignaciones_stock_pkey PRIMARY KEY (id);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: categoria categoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categoria
    ADD CONSTRAINT categoria_pkey PRIMARY KEY (id_categoria);


--
-- Name: detalle_ingreso detalle_ingreso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_ingreso
    ADD CONSTRAINT detalle_ingreso_pkey PRIMARY KEY (id_detalle_ingreso);


--
-- Name: detalle_orden detalle_orden_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_orden
    ADD CONSTRAINT detalle_orden_pkey PRIMARY KEY (id_detalle_orden);


--
-- Name: detalle_pedido detalle_pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_pkey PRIMARY KEY (id_detalle_pedido);


--
-- Name: direccion direccion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direccion
    ADD CONSTRAINT direccion_pkey PRIMARY KEY (id_direccion);


--
-- Name: edificio edificio_cui_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edificio
    ADD CONSTRAINT edificio_cui_key UNIQUE (cui);


--
-- Name: edificio edificio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edificio
    ADD CONSTRAINT edificio_pkey PRIMARY KEY (id_edificio);


--
-- Name: ingreso ingreso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingreso
    ADD CONSTRAINT ingreso_pkey PRIMARY KEY (id_ingreso);


--
-- Name: institucion institucion_cue_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institucion
    ADD CONSTRAINT institucion_cue_key UNIQUE (cue);


--
-- Name: institucion institucion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institucion
    ADD CONSTRAINT institucion_pkey PRIMARY KEY (id_institucion);


--
-- Name: licitacion licitacion_nro_expediente_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitacion
    ADD CONSTRAINT licitacion_nro_expediente_key UNIQUE (nro_expediente);


--
-- Name: licitacion licitacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitacion
    ADD CONSTRAINT licitacion_pkey PRIMARY KEY (id_licitacion);


--
-- Name: movimiento_stock movimiento_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento_stock
    ADD CONSTRAINT movimiento_stock_pkey PRIMARY KEY (id_movimiento);


--
-- Name: movimientos movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_pkey PRIMARY KEY (id);


--
-- Name: orden_dispensacion orden_dispensacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_dispensacion
    ADD CONSTRAINT orden_dispensacion_pkey PRIMARY KEY (id_orden);


--
-- Name: pedido pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido
    ADD CONSTRAINT pedido_pkey PRIMARY KEY (id_pedido);


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);


--
-- Name: permiso permiso_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permiso
    ADD CONSTRAINT permiso_codigo_key UNIQUE (codigo);


--
-- Name: permiso permiso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permiso
    ADD CONSTRAINT permiso_pkey PRIMARY KEY (id_permiso);


--
-- Name: producto producto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT producto_pkey PRIMARY KEY (id_producto);


--
-- Name: proveedor proveedor_cuit_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor
    ADD CONSTRAINT proveedor_cuit_key UNIQUE (cuit);


--
-- Name: proveedor proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor
    ADD CONSTRAINT proveedor_pkey PRIMARY KEY (id_proveedor);


--
-- Name: rol rol_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol
    ADD CONSTRAINT rol_nombre_key UNIQUE (nombre);


--
-- Name: rol_permiso rol_permiso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_pkey PRIMARY KEY (id_rol, id_permiso);


--
-- Name: rol rol_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol
    ADD CONSTRAINT rol_pkey PRIMARY KEY (id_rol);


--
-- Name: aprobacion_seguimiento unique_aprobacion; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aprobacion_seguimiento
    ADD CONSTRAINT unique_aprobacion UNIQUE (id_pedido, id_rol_interviniente);


--
-- Name: asignaciones_stock uq_asignaciones_stock_periodo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignaciones_stock
    ADD CONSTRAINT uq_asignaciones_stock_periodo UNIQUE (institucion_id, producto_id, periodo);


--
-- Name: usuario usuario_dni_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_dni_key UNIQUE (dni);


--
-- Name: usuario usuario_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_email_key UNIQUE (email);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id_usuario);


--
-- Name: usuario_rol usuario_rol_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_rol
    ADD CONSTRAINT usuario_rol_pkey PRIMARY KEY (id_usuario, id_rol);


--
-- Name: idx_asignaciones_periodo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asignaciones_periodo ON public.asignaciones_stock USING btree (periodo);


--
-- Name: idx_auditoria_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_created_at ON public.auditoria USING btree (created_at DESC);


--
-- Name: idx_movimiento_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimiento_producto ON public.movimiento_stock USING btree (id_producto);


--
-- Name: idx_movimiento_stock_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimiento_stock_fecha ON public.movimiento_stock USING btree (fecha_movimiento DESC);


--
-- Name: idx_orden_institucion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orden_institucion ON public.orden_dispensacion USING btree (id_institucion);


--
-- Name: idx_pedido_institucion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedido_institucion ON public.pedido USING btree (id_institucion);


--
-- Name: idx_pedidos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_estado ON public.pedidos USING btree (estado);


--
-- Name: uq_producto_codigo_not_null; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_producto_codigo_not_null ON public.producto USING btree (codigo) WHERE (codigo IS NOT NULL);


--
-- Name: ajustes trg_ajustes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ajustes_updated_at BEFORE UPDATE ON public.ajustes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: asignaciones_stock trg_asignaciones_stock_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_asignaciones_stock_updated_at BEFORE UPDATE ON public.asignaciones_stock FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: institucion trg_institucion_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_institucion_updated_at BEFORE UPDATE ON public.institucion FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: movimiento_stock trg_movimiento_stock_sync_producto; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_movimiento_stock_sync_producto AFTER INSERT OR DELETE OR UPDATE ON public.movimiento_stock FOR EACH ROW EXECUTE FUNCTION public.fn_sync_stock_from_movimiento_stock();


--
-- Name: movimientos trg_movimientos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_movimientos_updated_at BEFORE UPDATE ON public.movimientos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: pedidos trg_pedidos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: producto trg_producto_defaults_compat; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_producto_defaults_compat BEFORE INSERT OR UPDATE ON public.producto FOR EACH ROW EXECUTE FUNCTION public.fn_producto_defaults_compat();


--
-- Name: producto trg_producto_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_producto_updated_at BEFORE UPDATE ON public.producto FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: proveedor trg_proveedor_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_proveedor_updated_at BEFORE UPDATE ON public.proveedor FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: movimientos trg_sync_legacy_movimientos_to_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_legacy_movimientos_to_stock AFTER INSERT ON public.movimientos FOR EACH ROW EXECUTE FUNCTION public.fn_sync_legacy_movimientos_to_stock();


--
-- Name: institucion trg_sync_nivel_institucion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_nivel_institucion BEFORE INSERT OR UPDATE ON public.institucion FOR EACH ROW EXECUTE FUNCTION public.fn_sync_nivel_institucion();


--
-- Name: ajustes ajustes_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ajustes
    ADD CONSTRAINT ajustes_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id_producto);


--
-- Name: ajustes ajustes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ajustes
    ADD CONSTRAINT ajustes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id_usuario);


--
-- Name: aprobacion_seguimiento aprobacion_seguimiento_id_pedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aprobacion_seguimiento
    ADD CONSTRAINT aprobacion_seguimiento_id_pedido_fkey FOREIGN KEY (id_pedido) REFERENCES public.pedido(id_pedido);


--
-- Name: aprobacion_seguimiento aprobacion_seguimiento_id_rol_interviniente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aprobacion_seguimiento
    ADD CONSTRAINT aprobacion_seguimiento_id_rol_interviniente_fkey FOREIGN KEY (id_rol_interviniente) REFERENCES public.rol(id_rol);


--
-- Name: aprobacion_seguimiento aprobacion_seguimiento_id_usuario_firma_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aprobacion_seguimiento
    ADD CONSTRAINT aprobacion_seguimiento_id_usuario_firma_fkey FOREIGN KEY (id_usuario_firma) REFERENCES public.usuario(id_usuario);


--
-- Name: asignaciones_stock asignaciones_stock_institucion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignaciones_stock
    ADD CONSTRAINT asignaciones_stock_institucion_id_fkey FOREIGN KEY (institucion_id) REFERENCES public.institucion(id_institucion) ON DELETE CASCADE;


--
-- Name: asignaciones_stock asignaciones_stock_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignaciones_stock
    ADD CONSTRAINT asignaciones_stock_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id_producto) ON DELETE CASCADE;


--
-- Name: detalle_ingreso detalle_ingreso_id_ingreso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_ingreso
    ADD CONSTRAINT detalle_ingreso_id_ingreso_fkey FOREIGN KEY (id_ingreso) REFERENCES public.ingreso(id_ingreso);


--
-- Name: detalle_ingreso detalle_ingreso_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_ingreso
    ADD CONSTRAINT detalle_ingreso_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.producto(id_producto);


--
-- Name: detalle_orden detalle_orden_id_orden_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_orden
    ADD CONSTRAINT detalle_orden_id_orden_fkey FOREIGN KEY (id_orden) REFERENCES public.orden_dispensacion(id_orden);


--
-- Name: detalle_orden detalle_orden_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_orden
    ADD CONSTRAINT detalle_orden_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.producto(id_producto);


--
-- Name: detalle_pedido detalle_pedido_id_pedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_id_pedido_fkey FOREIGN KEY (id_pedido) REFERENCES public.pedido(id_pedido);


--
-- Name: detalle_pedido detalle_pedido_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.producto(id_producto);


--
-- Name: auditoria fk_auditoria_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuario(id_usuario) ON DELETE SET NULL;


--
-- Name: edificio fk_direccion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edificio
    ADD CONSTRAINT fk_direccion FOREIGN KEY (id_direccion) REFERENCES public.direccion(id_direccion);


--
-- Name: movimiento_stock fk_movimiento_stock_proveedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento_stock
    ADD CONSTRAINT fk_movimiento_stock_proveedor FOREIGN KEY (id_proveedor) REFERENCES public.proveedor(id_proveedor);


--
-- Name: ingreso ingreso_id_licitacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingreso
    ADD CONSTRAINT ingreso_id_licitacion_fkey FOREIGN KEY (id_licitacion) REFERENCES public.licitacion(id_licitacion);


--
-- Name: ingreso ingreso_id_proveedor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingreso
    ADD CONSTRAINT ingreso_id_proveedor_fkey FOREIGN KEY (id_proveedor) REFERENCES public.proveedor(id_proveedor);


--
-- Name: ingreso ingreso_id_usuario_receptor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingreso
    ADD CONSTRAINT ingreso_id_usuario_receptor_fkey FOREIGN KEY (id_usuario_receptor) REFERENCES public.usuario(id_usuario);


--
-- Name: institucion institucion_id_edificio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institucion
    ADD CONSTRAINT institucion_id_edificio_fkey FOREIGN KEY (id_edificio) REFERENCES public.edificio(id_edificio);


--
-- Name: movimiento_stock movimiento_stock_id_detalle_ingreso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento_stock
    ADD CONSTRAINT movimiento_stock_id_detalle_ingreso_fkey FOREIGN KEY (id_detalle_ingreso) REFERENCES public.detalle_ingreso(id_detalle_ingreso);


--
-- Name: movimiento_stock movimiento_stock_id_detalle_orden_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento_stock
    ADD CONSTRAINT movimiento_stock_id_detalle_orden_fkey FOREIGN KEY (id_detalle_orden) REFERENCES public.detalle_orden(id_detalle_orden);


--
-- Name: movimiento_stock movimiento_stock_id_institucion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento_stock
    ADD CONSTRAINT movimiento_stock_id_institucion_fkey FOREIGN KEY (id_institucion) REFERENCES public.institucion(id_institucion);


--
-- Name: movimiento_stock movimiento_stock_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento_stock
    ADD CONSTRAINT movimiento_stock_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.producto(id_producto);


--
-- Name: movimiento_stock movimiento_stock_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento_stock
    ADD CONSTRAINT movimiento_stock_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);


--
-- Name: movimientos movimientos_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id_producto);


--
-- Name: movimientos movimientos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos
    ADD CONSTRAINT movimientos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id_usuario);


--
-- Name: orden_dispensacion orden_dispensacion_id_institucion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_dispensacion
    ADD CONSTRAINT orden_dispensacion_id_institucion_fkey FOREIGN KEY (id_institucion) REFERENCES public.institucion(id_institucion);


--
-- Name: orden_dispensacion orden_dispensacion_id_pedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_dispensacion
    ADD CONSTRAINT orden_dispensacion_id_pedido_fkey FOREIGN KEY (id_pedido) REFERENCES public.pedido(id_pedido);


--
-- Name: orden_dispensacion orden_dispensacion_id_usuario_despacha_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_dispensacion
    ADD CONSTRAINT orden_dispensacion_id_usuario_despacha_fkey FOREIGN KEY (id_usuario_despacha) REFERENCES public.usuario(id_usuario);


--
-- Name: pedido pedido_id_institucion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido
    ADD CONSTRAINT pedido_id_institucion_fkey FOREIGN KEY (id_institucion) REFERENCES public.institucion(id_institucion);


--
-- Name: pedido pedido_id_usuario_solicitante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido
    ADD CONSTRAINT pedido_id_usuario_solicitante_fkey FOREIGN KEY (id_usuario_solicitante) REFERENCES public.usuario(id_usuario);


--
-- Name: pedidos pedidos_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id_producto);


--
-- Name: pedidos pedidos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id_usuario);


--
-- Name: producto producto_id_categoria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT producto_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.categoria(id_categoria);


--
-- Name: rol_permiso rol_permiso_id_permiso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_id_permiso_fkey FOREIGN KEY (id_permiso) REFERENCES public.permiso(id_permiso) ON DELETE CASCADE;


--
-- Name: rol_permiso rol_permiso_id_rol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.rol(id_rol) ON DELETE CASCADE;


--
-- Name: usuario usuario_id_institucion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_id_institucion_fkey FOREIGN KEY (id_institucion) REFERENCES public.institucion(id_institucion);


--
-- Name: usuario_rol usuario_rol_id_rol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_rol
    ADD CONSTRAINT usuario_rol_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.rol(id_rol);


--
-- Name: usuario_rol usuario_rol_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_rol
    ADD CONSTRAINT usuario_rol_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);


--
-- PostgreSQL database dump complete
--

\unrestrict NXxGBgubRcTrJZYc7BET0QoxP1BXdJ1D2TOFQBOOvSYENvwbSqMTK7ZgGbky5dh

