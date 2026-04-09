--
-- PostgreSQL database dump
--

\restrict 6oSo2h90lB1l5yUD9gCmoNByG4uYrwfVuhUqYV8HjA4VpS5mUwDWdWo0t28eskH

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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ajustes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ajustes (
    id integer NOT NULL,
    producto_id integer,
    cantidad_anterior integer NOT NULL,
    cantidad_nueva integer NOT NULL,
    motivo text NOT NULL,
    usuario_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    id integer NOT NULL,
    usuario_id integer,
    entidad text NOT NULL,
    accion text NOT NULL,
    id_registro integer,
    cambios jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
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
    localidad character varying(50),
    departamento character varying(50),
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
    nombre character varying(200) NOT NULL,
    cue character varying(100),
    id_edificio integer,
    establecimiento_cabecera character varying(100),
    nivel_educativo character varying(50),
    categoria character varying(20),
    ambito character varying(20),
    activo boolean DEFAULT true
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
 SELECT i.id_institucion,
    i.nombre,
    i.cue,
    e.id_edificio,
    d.calle,
    d.numero_puerta,
    d.localidad,
    d.departamento,
    d.codigo_postal,
    d.latitud,
    d.longitud,
    d.te_voip,
    d.letra_zona
   FROM ((public.institucion i
     JOIN public.edificio e ON ((i.id_edificio = e.id_edificio)))
     JOIN public.direccion d ON ((e.id_direccion = d.id_direccion)));


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
    id_usuario integer,
    motivo text
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
-- Name: movimientos; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.movimientos AS
 SELECT id_movimiento AS id,
    id_producto AS producto_id,
    (tipo)::text AS tipo,
    cantidad,
    NULL::integer AS usuario_id,
    ''::text AS motivo,
    ''::text AS proveedor,
    ''::text AS cue,
    NULL::integer AS pedido_id,
    fecha_movimiento AS created_at
   FROM public.movimiento_stock;


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
-- Name: pedidos; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pedidos AS
 SELECT p.id_pedido AS id,
    p.id_usuario_solicitante AS usuario_id,
    ( SELECT dp.id_producto
           FROM public.detalle_pedido dp
          WHERE (dp.id_pedido = p.id_pedido)
         LIMIT 1) AS producto_id,
    (COALESCE(( SELECT sum(dp.cantidad_solicitada) AS sum
           FROM public.detalle_pedido dp
          WHERE (dp.id_pedido = p.id_pedido)), (0)::bigint))::integer AS cantidad,
    COALESCE(i.nombre, ''::character varying) AS institucion,
    (p.estado)::text AS estado,
    p.observaciones_generales AS notas,
    p.fecha_creacion AS created_at,
    p.fecha_creacion AS updated_at
   FROM (public.pedido p
     LEFT JOIN public.institucion i ON ((p.id_institucion = i.id_institucion)));


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
    CONSTRAINT producto_stock_actual_check CHECK ((stock_actual >= 0)),
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
    nombre AS codigo,
    nombre,
    'Insumos'::text AS tipo,
    ''::text AS descripcion,
    ''::text AS proveedor,
    0.00 AS precio,
    COALESCE(( SELECT sum(
                CASE
                    WHEN (m.tipo = 'ingreso'::public.tipo_movimiento) THEN m.cantidad
                    WHEN (m.tipo = 'egreso'::public.tipo_movimiento) THEN (- m.cantidad)
                    ELSE 0
                END) AS sum
           FROM public.movimiento_stock m
          WHERE (m.id_producto = producto.id_producto)), (0)::bigint) AS stock_actual,
    now() AS created_at,
    now() AS updated_at
   FROM public.producto;


--
-- Name: proveedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedor (
    id_proveedor integer NOT NULL,
    nombre character varying(100),
    cuit character varying(20),
    contacto character varying(100)
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
    role character varying(20) DEFAULT 'consulta'::character varying,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: users; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.users AS
 SELECT id_usuario AS id,
    nombre,
    apellido,
    dni AS cue,
    email,
    password AS password_hash,
    telefono,
    id_institucion AS institucion,
    role,
    activo,
    created_at
   FROM public.usuario;


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
-- Name: orden_dispensacion id_orden; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_dispensacion ALTER COLUMN id_orden SET DEFAULT nextval('public.orden_dispensacion_id_orden_seq'::regclass);


--
-- Name: pedido id_pedido; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido ALTER COLUMN id_pedido SET DEFAULT nextval('public.pedido_id_pedido_seq'::regclass);


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

COPY public.ajustes (id, producto_id, cantidad_anterior, cantidad_nueva, motivo, usuario_id, created_at) FROM stdin;
\.


--
-- Data for Name: aprobacion_seguimiento; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.aprobacion_seguimiento (id_aprobacion, id_pedido, id_rol_interviniente, id_usuario_firma, estado_resultante, observacion, fecha_firma) FROM stdin;
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
1	MAESTRA ACIAR Y MAESTRO ANEA	S/N	CAMPO AFUERA	ALBARDON	5419	-31.4223061	-68.5461207	4307748	S
2	BELGRANO	1850	VILLA SAN MARTIN	ALBARDON	5419	-31.4382656	-68.5219123	4307753	S
3	LOZANO 	S/N	EL TOPON	ALBARDON	5419	-31.4248844	-68.488803	4307798	S
4	GENERAL ACHA 	S/N	LA CANADA	ALBARDON	5419	-31.4441301	-68.4745589	4307763	S
5	LA LAJA	2523	LAS LOMITAS	ALBARDON	5419	-31.4147926	-68.4926974	4307744	S
6	LA LAJA	6903	LAS PIEDRITAS	ALBARDON	5419	-31.3781646	-68.4753671	4307761	S
7	COMANDANTE CABOT ENTRE CANAL NORTE Y FERMIN MONLA	S/N	LAS TAPIAS	ALBARDON	5419	-31.457353	-68.5649523	4307743	S
8	RINCON Y ESQUIU	S/N	OBISPO ZAPATA	ALBARDON	5419	-31.4434096	-68.5438821	4307760	S
9	LAS HERAS Y HUARPES	S/N	LAS TIERRITAS	ALBARDON	5419	-31.3679158	-68.4393488	4307764	S
10	RAWSON ENTRE CALLES LA PAZ Y NACIONAL	1850	VILLA SAN MARTIN	ALBARDON	5419	-31.4344873	-68.5270326	4307759	S
11	CALLE NACIONAL	1221	VILLA SAN MARTIN	ALBARDON	5419	-31.4288871	-68.5108114	4307755	S
12	ESMERALDA Y PROYECTADA	S/N	ALBARDON	ALBARDON	5419	-31.4316683	-68.4943972	4307756	S
13	NACIONAL	2951	VILLA SAN MIGUEL	ALBARDON	5419	-31.4277722	-68.5290596	4307765	S
14	SANTA ELENA ENTRE RP 87 Y ESTACIoN JUAN JUFRE	S/N	EL ALAMITO	ANGACO	5415	-31.45666	-68.3415718	4307738	S
15	EL BOSQUE  ENTRE CAMPODONICO Y ROSENTAL	S/N	EL BOSQUE	ANGACO	5415	-31.4436342	-68.2820492	4307740	S
16	OLIVERA  ENTRE BOSQUE Y PLUMERILLO	S/N	PLUMERILLO	ANGACO	5415	-31.4355558	-68.3812141	4307736	S
17	AGUILERA 	S/N	LA CANADA	ANGACO	5415	-31.4422725	-68.4520852	4307887	S
18	21 DE FEBRERO ENTRE NACIONAL Y OLIVERA	S/N	LAS TAPIAS	ANGACO	5415	-31.4070861	-68.3830715	4307733	S
19	PINCHAGUAL ENTRE 21 DE FEBRERO Y VELAZQUEZ	S/N	EL BOSQUE	ANGACO	5415	-31.4085043	-68.2992327	4307739	S
20	RUTA NACIONAL EVA PERON	S/N	PUNTA DEL MONTE	ANGACO	5415	-31.392908	-68.3957524	4307869	S
21	JUAN JUFRE Y SANTA MARIA DE ORO	S/N	VILLA DEL SALVADOR	ANGACO	5415	-31.4544187	-68.4032372	4307715	S
22	RUTA PROVINCIAL 412 KM 135	S/N	CALINGASTA	CALINGASTA	5403	-31.3342422	-69.4242236	4302365	T
23	RUTA NÂº 412 KM. 135	S/N	ALCAPARROSA	CALINGASTA	5403	-31.3027676	-69.4128043	4307876	T
24	RUTA PROVINCIAL 406	S/N	ALTO CALINGASTA	CALINGASTA	5403	-31.3573047	-69.4460583	4307716	T
25	HIPOLITO IRIGOYEN ENTRE M. MORENO Y PTE. ROCA	145	BARREAL	CALINGASTA	5403	-31.6648931	-69.4824772	4307728	T
26	CALLE LAS HORNILLAS	S/N	LAS HORNILLAS	CALINGASTA	5403	-31.7051318	-69.4924557	4307729	T
27	SAN MARTIN 	S/N	BARREAL	CALINGASTA	5403	-31.6501187	-69.4739873	4307735	T
28	PRESIDENTE ROCA	2148	BARREAL	CALINGASTA	5403	-31.6226472	-69.4655044	4307799	T
29	RUTA NACIONAL NÂ° 149	S/N	COLON	CALINGASTA	5403	-31.4280977	-69.4079943	4307737	T
30	RUTA NACIONAL NÂ° 149	S/N	HILARIO	CALINGASTA	5403	-31.4786609	-69.4022372	4307875	T
31	RUTA NACIONAL NÂ° 149	S/N	LA ISLA	CALINGASTA	5403	-31.3807857	-69.4160734	4307866	T
32	RUTA PROVINCIAL 412 	S/N	PUCHUZUM	CALINGASTA	5403	-31.1374661	-69.4699205	4307871	T
33	PRESIDENTE ROCA	S/N	SOROCAYENSE	CALINGASTA	5403	-31.5576477	-69.4422176	4307762	T
34	FLORIDA 	98	TAMBERIAS	CALINGASTA	5403	-31.4770917	-69.4243913	4307745	T
35	SARMIENTO	41	TAMBERIAS	CALINGASTA	5403	-31.4573854	-69.4218456	4307731	T
36	RUTA PROVINCIAL NÂ° 412 	S/N	VILLA CORRAL	CALINGASTA	5403	-31.2518835	-69.4459786	4307870	T
37	RUTA PROVINCIAL NÂ° 412 	S/N	VILLA NUEVA	CALINGASTA	5403	-31.0546019	-69.4937773	4307872	T
38	GENERAL PAZ	1049	VILLA DEL CARRIL	CAPITAL	5400	-31.5427748	-68.5409464	4307543	A
39	AV. ALEM 	650	CAPITAL	CAPITAL	5400	-31.5279936	-68.5339959	4307532	A
40	SANTA FE ENTRE TUCUMAN Y AV.RIOJA	252	CAPITAL	CAPITAL	5400	-31.538747	-68.5220713	4302167, 4307581, 4307701	B
41	ALBERDI	175	CONCEPCION	CAPITAL	5400	-31.5260136	-68.5241868	4307845	B
42	AV. ESPANA	1420	TRINIDAD	CAPITAL	5400	-31.5524823	-68.5327831	4307547	C
43	AV. LIBERTADOR SAN MARTIN	381	CAPITAL	CAPITAL	5400	-31.5343871	-68.5312527	4307549	C
44	ESTADOS UNIDOS	500	CAPITAL	CAPITAL	5400	-31.5406931	-68.5113321	4302283	P
45	AV. L. N. ALEM	31	CAPITAL	CAPITAL	5400	-31.5352019	-68.5321763	4307577	B
46	SAN LUIS	626	CAPITAL	CAPITAL	5400	-31.5322303	-68.5172446	4307512	A
47	AV. IGNACIO DE LA ROSA	325	CAPITAL	CAPITAL	5400	-31.5322303	-68.5172446	4307566	B
48	GENERAL ACHA	426	CAPITAL	CAPITAL	5400	-31.5239609	-68.52394406	4302183	C
49	PARAGUAY	899	CONCEPCION	CAPITAL	5400	-31.5393812	-68.5150785	4307576	C
50	BELGRANO ENTRE AV. RIOJA Y TUCUMAN	250	CAPITAL	CAPITAL	5400	-31.5447321	-68.5215259	4302240, 4307572, 437669	A
51	RIVADAVIA	330	CAPITAL	CAPITAL	5400	-31.5371185	-68.5304721	4307563	A
52	LAS HERAS	520	CAPITAL	CAPITAL	5400	-31.5416321	-68.5376248	4307568	A
53	SALVADOR MARIA DEL CARRIL Y CIRCUNVALACION	S/N	CONCEPCION	CAPITAL	5400	-31.5199245	-68.5338872	4307534	C
54	AV. RAWSON	420	CAPITAL	CAPITAL	5400	-31.5395567	-68.5130146	4307503	C
55	MARIANO MORENO Y R. BACA	S/N	TRINIDAD	CAPITAL	5400	-31.5455385	-68.5115291	4307567	B
56	AV. LIB. S. MARTIN ENTRE SARMIENTO Y ENTRE RIOS	158	CAPITAL	CAPITAL	5400	-31.5345378	-68.5282193	4307528	C
57	GUEMES	146	CAPITAL	CAPITAL	5400	-31.5317834	-68.5164894	4307536	C
58	25 DE MAYO	1057	CAPITAL	CAPITAL	5400	-31.530211	-68.5418708	4307533	C
59	VIRGEN DE LOURDES	1530	BÂ° S.M.A.T.A.	CAPITAL	5400	-31.5146101	-68.554718	4307115	A
60	DR. AGUSTO ECHEGARAY 	2364	DESAMPARADOS	CAPITAL	5400	-31.5270388	-68.5646721	4307542	C
61	TUCUMAN	1633	CAPITAL	CAPITAL	5400	-31.5143617	-68.5240459	4307602	C
62	MARY OÂ´GRAHAM	71	BÂ° CABOT	CAPITAL	5400	-31.5113486	-68.529373	4302122	C
63	LAPRIDA	1599	DESAMPARADOS	CAPITAL	5400	-31.5346496	-68.54959967	4307518	C
64	SALTA	1279	CONCEPCION	CAPITAL	5400	-31.5195209	-68.536742	4307535	C
65	SAN LORENZO	281	CONCEPCION	CAPITAL	5400	-31.5184438	-68.5244521	4307524	C
66	SATURNINO SALAS	1285	CONCEPCION	CAPITAL	5400	-31.5175771	-68.5148545	4302450	C
67	DEL BONO	348	CAPITAL	CAPITAL	5400	-31.5331979	-68.5577268	4307552	A
68	PAULA A. DE SARMIENTO	196	DESAMPARADOS	CAPITAL	5400	-31.5274887	-68.5549988	4307817	A
69	SARGENTO CABRAL	1734	DESAMPARADOS	CAPITAL	5400	-31.5201305	-68.5555699	4307536	C
70	GENERAL ACHA	1836	TRINIDAD	CAPITAL	5400	-31.5584351	-68.5219086	7302250	C
71	AGUSTIN GOMEZ	163	TRINIDAD	CAPITAL	5400	-31.5529041	-68.5218881	4307506	C
72	PATRICIAS SANJUANINAS	1126	TRINIDAD	CAPITAL	5400	-31.5469659	-68.5125489	4307538	C
73	ABRAHAM TAPIA Y CIRCUNVALACION	S/N	TRINIDAD	CAPITAL	5400	-31.5543494	-68.5194407	4307526	C
74	BENJAMIN AGUILAR	255	TRINIDAD	CAPITAL	5400	-31.5473463	-68.5279463	4307529	C
75	SATURNINO SARASSA	1425	CAPITAL	CAPITAL	5400	-31.5517277	-68.5415162	4272388	B
76	URQUIZA 	182	CAUCETE	CAUCETE	5442	-31.6534866	-68.2820104	4307893	F
77	9 DE JULIO	964	CAUCETE	CAUCETE	5442	-31.65427	-68.273848	4302146	F
78	CORONEL CABOT Y J. J. BUSTO	S/N	CAUCETE	CAUCETE	5442	-31.4765609	-67.3031857	4307998	F
79	IVISORIA  ENTRE CALLE 20 Y RUTA PROV. 270 	S/N	CAUCETE	CAUCETE	5442	-31.7038054	-68.2942406	4307946	F
80	BERMEJO 	S/N	LAGUNA SECA BERMEJO	CAUCETE	5442	-31.589197	-67.6604747	4302156	F
81	6 DE AGOSTO Y CHACO 	S/N	CAUCETE	CAUCETE	5442	-31.645411	-68.2899949	4307897	F
82	JUAN JOSE BUSTOS	904	CAUCETE	CAUCETE	5442	-31.6579699	-682748978	4302509	F
83	BUENOS AIRES	S/N	EL RINCON	CAUCETE	5442	-31.6695987	-68.31862	4307895	F
84	RUTA 141 KM. 62 	S/N	LA PLANTA	CAUCETE	5442	-31.4765667	-67.3031057	4302139	F
85	ENFERMERA MEDINA - LAS TALAS	S/N	LA PUNTILLA	CAUCETE	5442	-31.6016216	-68.2903107	4307970	F
86	JUAN LAVALLE 	S/N	LA PUNTILLA	CAUCETE	5442	-31.5925854	-68.3046788	4307971	F
87	BARTOLOME MITRE 	S/N	LAS CHACRAS	CAUCETE	5442	-31.2796841	-67.5276484	No registrado	F
88	LAS LIEBRES 	S/N	LAS LIEBRES	CAUCETE	5442	-31.8886557	-66.8930197	No registrado	F
89	JUAN JOSE BUSTOS 	S/N	LOS MEDANOS	CAUCETE	5442	-31.6279078	-68.2683528	4302185	F
90	PATRICIAS SANJUANINAS 	S/N	LOS MEDANOS	CAUCETE	5442	-31.6409971	-68.2365632	4307894	F
91	COLON Y RUTA NÂ° 270	S/N	LOTES DE ALVAREZ	CAUCETE	5442	-31.6677855	-68.2925554	4307891	F
92	PASO DE LOS ANDES 	S/N	MARAYES	CAUCETE	5442	-31.4611018	-67.3522416	4302150	F
93	SAN LORENZO	S/N	PIE DE PALO	CAUCETE	5442	-31.6633866	-68.2209733	4307890	F
94	COLON 	S/N	POZO DE LOS ALGARROBOS	CAUCETE	5442	-31.6786902	-68.2311153	4302215	F
95	PASO DE LOS ANDES 	S/N	POZO DE LOS ALGARROBOS	CAUCETE	5442	-31.6920233	-68.2219392	4307979	F
96	RUTA 141 KM. 62 	S/N	VALLECITO - PARAJE DIFUNTA CORREA	CAUCETE	5442	-31.7366426	-67.9840852	4302149	F
97	SAN LORENZO Y PEDRO ECHAGUE	S/N	LOS MEDANOS	CAUCETE	5442	-31.6237884	-68.6237884	4307894	F
98	BENAVIDEZ	6195	VILLA UNION	CHIMBAS	5413	-31.5103906	-68.6047773	4178346	S
99	AMEGHINO	774	BÂ° PARQUE INDEPENDENCIA	CHIMBAS	5413	-31.5059627	-68.5224981	4302073	S
100	URQUIZA	52	BÂ° LAPRIDA	CHIMBAS	5413	-31.510463	0	4307624	S
101	TUCUMAN	343	CHIMBAS	CAPITAL	5413	-31.529707345290394	-68.52342464715562	4302174	S
102	AV. BENAVIDEZ	4771	BÂ° LOS ALERCES	CHIMBAS	5413	-31.5101647	-68.5860728	4307615	S
103	BELGRANO Y PATAGONIA	S/N	BÂº LOS PINOS	CHIMBAS	5413	-31.5089587	-68.5946658	4307847	S
104	NEUQUEN	S/N	BÂº LOS TAMARINDO	CHIMBAS	5413	-31.5066594	-68.5521968	4307625	S
105	25 DE MAYO	2770	BÂ° PARQUE INDUSTRIAL	CHIMBAS	5413	-31.4985472	-68.5645556	4307652	S
106	NECOCHEA	1514	CHIMBAS	CHIMBAS	5413	-31.5009549	-68.5084213	4307850	S
107	MENDOZA	2371	CHIMBAS NORTE	CHIMBAS	5413	-31.4843583	-68.5315594	4307623	S
108	ORATORIO	S/N	EL MOGOTE	CHIMBAS	5413	-31.4911075	-68.4751883	4307843	S
109	FERNANDEZ BARRIENTO Y ARENALES	S/N	EL MOGOTE	CHIMBAS	5413	-31.4812278	-68.4923805	4307819	S
110	CENTENARIO	2615	VILLA MARIA	CHIMBAS	5413	-31.480297	-68.5201084	4307622	S
111	SARGENTO CABRAL	S/N	VILLA MORRONE	CHIMBAS	5413	-31.5066023	-68.5632178	4307650	S
112	RASTREADOR CALIVAR	553	VILLA OBRERA	CHIMBAS	5413	-31.504181	-68.5991415	4307649	S
113	AGUSTIN GOMEZ Y BLAS PARERA	S/N	VILLA OBSERVATORIO	CHIMBAS	5413	-31.50976	-68.6180604	4307820	S
114	PRINCIPAL	S/N	COLANGUIL	IGLESIA	5467	-30.031471	-69.2914033	4302157	L
115	SAN MARTIN	1584	ANGUALASTO	IGLESIA	5467	-30.0544324	-69.1733909	4302125	L
116	BAUCHACETA	S/N	BAUCHACETA	IGLESIA	5467	-30.5107333	-69.46010824	4302148	L
117	PRINCIPAL	S/N	BELLA VISTA	IGLESIA	5467	-30.4323312	-69.2401616	4302147	L
118	GONZALEZ	S/N	COLOLA	IGLESIA	5467	-30.1921283	-69.1069788	4302109	L
119	SARMIENTO 	S/N	LAS FLORES	IGLESIA	5467	-30.3218668	-69.2043627	4302270	L
120	SANTO DOMINGO	4125	RODEO	IGLESIA	5467	-30.2117131	-69.1366418	432116	L
121	IBAZETA Y COLONIA 	S/N	RODEO	IGLESIA	5467	-30.2100968	-69.1619292	4307986	L
122	SAN ROQUE	S/N	TUDCUM	IGLESIA	5467	-30.1902064	-69.2709256	4302095	L
123	PRINCIPAL 	S/N	VILLA IGLESIA	IGLESIA	5467	-30.4143572	-69.2226879	4302087	L
124	RAWSON	843	SAN JOSE DE JACHAL	JACHAL	5460	-30.2462711	-68.7457019	4302045	G
125	CALLE SAN JUAN 	S/N	SAN JOSE DE JACHAL	JACHAL	5460	-30.2403947	-68.7498387	4302088	G
126	GRAL. ACHA Y AGUSTIN GOMEZ	S/N	SAN JOSE DE JACHAL	JACHAL	5460	-30.2395592	-68.7418319	4307900	G
127	RUTA NACIONAL 150 KM.3	S/N	PACHIMOCO	JACHAL	5460	-30.2252542	-68.7633947	4302052	G
128	CHUBUT Y ENTRE RIOS  	S/N	BÂº FRONTERAS ARGENTINAS	JACHAL	5460	-30.2449444	-68.7317669	4302069	G
129	EX-RUTA 40 	S/N	NIQUIVIL	JACHAL	5460	-30.3996733	-68.6946359	4302067	G
130	PROLONGACION MARTIN FIERRO 	S/N	BOCA DE LA QUEBRADA	JACHAL	5460	-30.1497977	-68.6612904	4302038	G
131	LA FALDA 	S/N	EL FICAL	JACHAL	5460	-30.2615716	-68.6699956	4302017	G
132	MONS. TOMAS S. CRUZ (EL FUERTE)	S/N	EL VOLCAN	JACHAL	5460	-30.3258091	-68.6968061	4302057	G
133	ALFONSO HERNANDEZ 	S/N	EL MEDANO	JACHAL	5460	-30.1266752	-68.6815118	4302037	G
134	CHEPICAL 	S/N	PUESTO CHEPICAL	JACHAL	5460	-29.7535785	-68.7583651	No registrado	G
135	RIVADAVIA	S/N	HUACO	JACHAL	5460	-30.158562	-68.4826924	4302055	G
136	OLIVARES	S/N	EL BAJO HUACO	JACHAL	5460	-30.1738986	-68.4788236	4302070	G
137	PASO DE LOS ANDES	S/N	ALTO HUACO	JACHAL	5460	-30.1382351	-68.5109627	4302051	G
138	RUTA PROVINCIAL 491	S/N	LA CIENEGA	JACHAL	5460	-30.1514222	-68.5731345	4302053	G
139	RUTA PROVINCIAL 491	S/N	LA FALDA	JACHAL	5460	-30.1900571	-68.6597903	4302065	G
140	SAN MARTIN 	S/N	LA FRONTERA	JACHAL	5460	-30.1010774	-68.7182487	4302044	G
141	PATRICIO LOPEZ DEL CAMPO 	S/N	PAMPA VIEJA	JACHAL	5460	-30.2281963	-68.6877301	4302025	G
142	NUEVA 	S/N	LA REPRESA	JACHAL	5460	-30.0861874	-68.6904441	4302007	G
143	POMPEYA	S/N	LOS PUESTOS	JACHAL	5460	-30.6822431	-68.3180831	4302410	G
144	SANTA BARBARA	S/N	MOGNA	JACHAL	5460	-30.6942326	-68.3611631	4302411	G
145	RUTA NÂ° 150 - KM 10	S/N	PACHIMOCO	JACHAL	5460	-30.1982301	-68.8291803	4302059	G
146	VARAS 	S/N	PAMPA DEL CHANAR	JACHAL	5460	-30.181917	-68.6797063	4302039	G
147	NORIEGA	S/N	PAMPA DEL CHANAR	JACHAL	5460	-30.151417	-68.6869921	4302046	G
148	CALLE NUEVA 	S/N	SAN ISIDRO	JACHAL	5460	-30.1433075	-68.7061726	4302009	G
149	VARAS 	S/N	PAMPA VIEJA	JACHAL	5460	-30.2143303	-68.6879204	4302008	G
150	AV. 25 DE MAYO	776	SAN JOSE DE JACHAL	JACHAL	5460	-30.2367757	-68.747635	4302058	G
151	EX-RUTA 472 Y PROGRESO	S/N	SAN ROQUE	JACHAL	5460	-30.2785628	-68.7038013	4302034	G
152	EUGENIO FLORES 	S/N	TAMBERIAS	JACHAL	5460	-30.1887014	-68.7254543	4302035	G
153	EUGENIO FLORES 	S/N	VILLA MERCEDES	JACHAL	5460	-30.1058235	-68.7005559	4302036	G
154	CHUBUT Y JUJUY	S/N	BÂº FRONTERAS ARGENTINAS	JACHAL	5460	-30.2440376	-68.7315371	4302038	G
155	CALLEJON DEL ALTO 	S/N	HUERTA DE HUACHI	JACHAL	5460	-30.0146258	-68.7513958	4302204	G
156	VALENTIN VIDELA	S/N	VILLA CABECERA	9 DE JULIO	5417	-31.6614853	-68.3810824	4307944	P
157	AMABLE JONES Y MAESTRO YACANTE	S/N	LA MAJADITA	9 DE JULIO	5417	-31.701916	-68.3687723	4307770	P
158	RUTA NÂ° 20 KM 13	S/N	LAS CHACRITAS	9 DE JULIO	5417	-31.5916644	-68.4115602	4307942	P
159	RUTA 20 KM 16	S/N	RINCON CERCADO	9 DE JULIO	5417	-31.6074824	-68.3784598	4307917	P
160	CALLE LAS FRAZADAS ENTRE MAURIN Y CALLE 8	S/N	RINCON CERCADO	9 DE JULIO	5417	-31.6483531	-68.3739409	4307918	P
161	DIAGONAL SAN MARTIN ENTRE SARMIENTO Y LAPRIDA	S/N	VILLA CABECERA	9 DE JULIO	5417	-31.6688904	-68.3908775	4307945	P
162	MENDOZA Y CALLE 17	S/N	LA RINCONADA	POCITO	5427	-31.7296984	-68.5660532	4307851	R
163	CALLEJON PEDRO GIL 	S/N	CAMPO DE BATALLA	POCITO	5427	-31.7650666	-68.5646308	4307632	R
164	ANACLETO GIL 	S/N	CARPINTERIA	POCITO	5427	-31.8206004	-68.5468873	4302108	R
165	MENDOZA KM 25	S/N	CARPINTERIA	POCITO	5427	-31.7523801	-68.5541021	4307638	R
166	FLORENCIO BASANEZ ZAVALLA	S/N	CARPINTERIA	POCITO	5427	-31.8217111	-68.5285821	4302808	R
167	GRAL. ACHA  ENTRE 7 Y 8	S/N	COLONIA RODAS	POCITO	5427	-31.6251312	-68.5286635	4307839	R
168	14 Y VIDART	S/N	RINCONADA	POCITO	5427	-31.6867607	-68.600767	4307806	R
169	AV UNAC ENTRE 7 Y 8	S/N	LA CALLECITA	POCITO	5427	-31.6231515	-68.5511426	4307630	R
170	CALLE 15 ENTRE ABERASTAIN Y MENDOZA	S/N	LA RINCONADA	POCITO	5427	-31.7049157	-68.5788833	4307641	R
171	CALLE 13 ENTRE RUTA 40 Y ALFONSO XXIII	S/N	LA RINCONADA	POCITO	5427	-31.6902735	-68.5265877	4307840	R
172	CHACABUCO Y 8	S/N	QUINTO CUARTEL	POCITO	5427	-31.6089849	-68.6016663	4307629	R
173	ING. MARCOS ZALAZAR 	S/N	CUARTO CARTEL	POCITO	5427	-31.6496396	-68.6033326	4307840	R
174	ABERASTAIN 	S/N	RINCONADA	POCITO	5427	-31.6915635	-68.5726921	4307829	R
175	CALLEJON ECHEGARAY VIDART ENTRE 7 Y 8	S/N	SEGUNDO CUARTEL	POCITO	5427	-31.6103765	-68.5770992	4307645	R
176	CALLE 9 Y VIDART	S/N	SEGUNDO CUARTEL	POCITO	5427	-31.6273951	-68.5849319	4307794	R
177	AVENIDA UNAC Y MARIANO MORENO	15	VILLA ABERASTAIN	POCITO	5427	-31.6492944	-68.5626136	4302276	R
178	SANTA MARIA DE ORO	233	VILLA ABERASTAIN	POCITO	5427	-31.6576017	-68.5802145	4307860	R
179	CALLE 12 ENTRE MENDOZA Y RUTA NÂ° 40	S/N	VILLA ABERASTAIN	POCITO	5427	-31.6706665	-68.5626803	4302357	R
180	FURQUE Y PICON	S/N	VILLA ABERASTAIN	POCITO	5427	-31.659607	-68.5812476	4307643	R
181	GRANADEROS Y ALVEAR	S/N	VILLA PAOLINI	POCITO	5427	-31.5924898	-68.5430703	4307637	R
182	GENERAL ACHA Y RUTA 40	S/N	RAWSON	RAWSON	5406	-31.5767264	-68.5187055	4307683	R
183	MEGLIOLI 	4410	RAWSON	RAWSON	5406	-31.5707662	-68.587996	4307674	R
184	TENIENTE IBALEZ	270	BÂ° EDILCO	RAWSON	5406	-31.5638259	-68.5202094	4307666	R
185	BAHIA BLANCA Y AGUILAR	S/N	BÂ° HUALILAN	RAWSON	5406	-31.5630125	-68.5625421	4307862	R
186	TIERRA DEL FUEGO	S/N	BÂ° RESIDENCIAL OBRERO	RAWSON	5406	-31.5729316	-68.5269335	4307805	R
187	BOULEVAR SARMIENTO 	938	RAWSON	RAWSON	5406	-31.5739013	-68.537265	4307656	R
188	AVENIDA ESPANA	1923	RAWSON	RAWSON	5406	-31.5741732	-68.5382533	4307655	R
189	FELIX AGUILAR Y NEUQUEN	S/N	BÂ° BUENAVENTURA LUNA	RAWSON	5406	-31.5823418	-68.5601167	4307671	R
190	BAHIA BLANCA Y SANTIAGO DERQUI	S/N	BÂ° GUEMES	RAWSON	5406	-31.5630125	-68.5625421	4302179	R
191	JUAREZ CELMAN 	235	BÂ° HUGO MONTANO	RAWSON	5406	-31.5667504	-68.5613456	4307664	R
192	ALMAFUERTE 	S/N	BÂ° S. M. DEL CARRIL	RAWSON	5406	-31.5634501	-68.5379694	4307667	R
193	VALLE FERTIL Y CHACABUCO	S/N	BÂ° SAN RICARDO	RAWSON	5406	-31.583841	-68.532333	4302190	R
194	CALLE 6 Y LABRADOR	S/N	COLONIA RODAS	RAWSON	5406	-31.619063	-68.5024107	4307678	R
195	RODAS Y LAS CANITAS	S/N	LOS CORREDORES	RAWSON	5406	-31.561623	-68.5093986	4302074	R
196	FLORIDA Y LAS PIEDRITAS 	S/N	MEDANITO	RAWSON	5406	-31.5773329	-68.4815199	4307853	R
197	CALLLE 9 ENTRE GARIBALDI Y PUNTA DEL MONTE	S/N	MEDANO DE ORO	RAWSON	5406	-31.6572652	-68.4652977	4307672	R
198	BELGRANO ENTRE 8 Y 9	S/N	MEDANO DE ORO	RAWSON	5406	-31.6492501	-68.5012801	4307677	R
199	GABRIELA MISTRAL 	S/N	VÂº BOLANOS	RAWSON	5406	-31.6284928	-68.4813831	4307676	R
200	AMERICA ENTRE 13 Y 14	S/N	MEDANO DE ORO	RAWSON	5406	-31.7066333	-68.4850941	4307824	R
201	CALLE 11 Y AMERICA	S/N	MEDANO DE ORO	RAWSON	5406	-31.6843705	-68.4811079	4307836	R
202	RUTA 155 Y AMERICA	S/N	MEDANO DE ORO	RAWSON	5406	-31.6017801	-68.4661477	4307614	R
203	CALLE 10 Y ALFONSO XIII	S/N	MEDANO DE ORO	RAWSON	5406	-31.6583314	-68.513447	4307823	R
204	MENDOZA	3335	RAWSON	RAWSON	5406	-31.5722838	-68.5303122	4307626	R
205	MAIPU	100	VÂº HIPODROMO	RAWSON	5406	-31.5650188	-68.5509355	4307686	R
206	ESPELETA 	550	VILLA KRAUSE	RAWSON	5406	-31.5851743	-68.5430246	4307627	R
207	CALLE 5 Y GRAL ACHA	S/N	RAWSON	RAWSON	5406	-31.5957644	-68.5165195	4302213	R
208	ARENALES E IBAZETA	S/N	BÂº SAN JUAN	RIVADAVIA	5407	-31.5468905	-68.5542368	4307588	O
209	IGNACIO DE LA ROZA	775	RIVADAVIA	RIVADAVIA	5407	-31.5379448	-68.5685158	4307816	O
210	COLL	2594	RIVADAVIA	RIVADAVIA	5407	-31.5167395	-68.5981721	4307841	O
211	MARIA E. DUARTE DE PERON Y LARRALDE 	S/N	BÂ° PARQUE RIVADAVIA NORTE	RIVADAVIA	5407	-31.5129362	-68.5816608	4307809	O
212	AV. LIB. GRAL. SAN MARTIN	4150	BÂº FORTABAT	RIVADAVIA	5407	-31.5283738	-68.5801594	4307598	O
213	LAVALLE 	S/N	BÂ° FORTABAT	RIVADAVIA	5407	-31.5367531	-68.5913627	4307837	O
214	ROQUE SAENZ PENA	430	BÂ° HUAZIUL	RIVADAVIA	5407	-31.51582	-68.5741427	4307597	O
215	ESMERALDA 	S/N	BÂ° UDAP III	RIVADAVIA	5407	-31.5535706	-68.5649409	4307586	O
216	2 DE ABRIL Y CATTANI	S/N	BÂ° ARAMBURU 	RIVADAVIA	5407	-31.5158417	-68.5656611	4307593	O
217	AVELLANEDA	2951	BÂ° JARDIN POLICIAL	RIVADAVIA	5407	-31.5502211	-68.5579105	4307584	O
218	JORGE NEWBERY	1851	BÂ° RIVADAVIA SUR	RIVADAVIA	5407	-31.5519787	-68.5489002	4307589	O
219	AVENIDA IGNACIO DE LA ROZA	4310	LA BEBIDA	RIVADAVIA	5407	-31.5399058	-68.6176477	4307612	O
220	LOTE HOGAR NÂ° 34	S/N	LA BEBIDA	RIVADAVIA	5407	-31.5482447	-68.618822	4307811	O
221	SAN JUAN	7306	MARQUEZADO	RIVADAVIA	5407	-31.523757	-68.6300713	4307838	O
222	HIPOLITO IRIGOYEN	2231	BÂ° NUEVA ARGENTINA	RIVADAVIA	5407	-31.5533554	-68.5667887	4307814	O
223	PERIODISTAS ARGENTINOS	5860	BÂº CAMUS	RIVADAVIA	5407	-31.5326874	-68.6005286	4307599	O
224	CALLE 5 ENTRE AMERICA Y PTA. DEL MONTE	S/N	MEDANO DE ORO	RAWSON	5406	-31.6203173	-68.4632339	4307679	R
225	AV. SARMIENTO	S/N	SAN ISIDRO	SAN MARTIN	5439	-31.5174031	-68.3519857	4307768	P
226	YAPEYU Y DIVISORIA	S/N	DOS ACEQUIAS	SAN MARTIN	5439	-31.46886	-68.4411594	4307785	P
227	RAWSON	1818	DOS ACEQUIAS	SAN MARTIN	5439	-31.5350384	-68.3994838	4307779	P
228	EVA PERON	4222	DOS ACEQUIAS	SAN MARTIN	5439	-31.4871523	-68.4152743	4302161	P
229	INDEPENDENCIA 	S/N	VILLA DOMINGUITO	SAN MARTIN	5439	-31.5598128	-68.2995335	4302083	P
230	DIVISORIA ENTRE ENTRE RIOS Y GODOY CRUZ	S/N	LOS COMPARTOS	SAN MARTIN	5439	-31.572008	-68.3474316	4302101	P
231	SAN ISIDRO 	S/N	SAN ISIDRO	SAN MARTIN	5439	-31.4848221	-68.3227366	4307773	P
232	INDEPENDENCIA Y LAPRIDA	S/N	SAN ISIDRO	SAN MARTIN	5439	-31.4923691	-68.3006278	4307772	P
233	LAPRIDA Y SAN ISIDRO	S/N	SAN ISIDRO	SAN MARTIN	5439	-31.4891956	-68.3245521	4307774	P
234	BELGRANO 	S/N	SAN ISIDRO	SAN MARTIN	5439	-31.5015635	-68.3670534	4307776	P
235	COLON Y 20 DE JUNIO	S/N	LA PUNILLA	SAN MARTIN	5439	-31.5544753	-68.3280069	4302097	P
236	AVENIDA SARMIENTO ESQUINA MITRE	S/N	VILLA LUGANO	SAN MARTIN	5439	-31.5198448	-68.3784651	4307788	P
237	HIPOLITO IRIGOYEN	2255	SANTA LUCIA	SANTA LUCIA	5411	-31.5414557	-68.4954959	4307694	P
238	HIPOLITO IRIGOYEN	3550	ESQUINA DEL SAUCE	SANTA LUCIA	5411	-31.5445312	-68.4823451	4307804	P
239	ROGER BALLET	2663	LAS PIEDRITAS	SANTA LUCIA	5411	-31.5220307	-68.4952152	4307688	P
240	ROQUE SAENZ PENA	2952	SANTA LUCIA	SANTA LUCIA	5411	-31.5291247	-68.48923	4307691	P
241	AV. LIBERTADOR SAN MARTIN	3411	VILLA MARIA	SANTA LUCIA	5411	-31.5339563	-68.4809991	4302238	P
242	HERNAN CORTEZ Y MAIPU 	S/N	ALTO DE SIERRA	SANTA LUCIA	5411	-31.5556248	-68.4175318	4307690	P
243	LIBERTADOR SAN MARTIN	6283	ALTO DE SIERRA	SANTA LUCIA	5411	-31.536172	-68.4377745	4307699	P
244	ROQUE SAENZ PENA	7051	ALTO DE SIERRA	SANTA LUCIA	5411	-31.526962	-68.4467547	4307842	P
245	TOMAS EDISON	1786	BERMEJITO	SANTA LUCIA	5411	-31.5118386	-68.5030772	4302198	P
246	FRAY MAMERTO ESQUIU	S/N	BARRIO KENNEDY	SANTA LUCIA	5411	-31.5270942	-68.5066057	4307646	P
247	RAUL CUELLO	4569	BÂ° BALCARCE	SANTA LUCIA	5411	-31.5337885	-68.4679337	4307698	P
248	CORDILLERA DE LOS ANDES	3219	COLONIA RICHET ZAPATA	SANTA LUCIA	5411	-31.5047956	-68.4866286	4307856	P
249	OMAR PALACIO	S/N	CANADA HONDA	SARMIENTO	5441	-31.9856413	-68.5487093	4302084	R
250	RUTA PROVINCIAL NÂ°351 	S/N	CIENEGUITA	SARMIENTO	5441	-32.0771257	-68.6923232	4302091	R
251	BUFANO 	S/N	COCHAGUAL	SARMIENTO	5441	-31.9659852	-68.3650896	4302078	R
252	NICOLAS AVELLANEDA 	S/N	COCHAGUAL	SARMIENTO	5441	-31.9655681	-68.3222525	4302175	R
253	RUTA NÂ° 295 	S/N	COCHAGUAL	SARMIENTO	5441	-31.869427	-68.3859432	4302940	R
254	CARMONA	S/N	COCHAGUAL	SARMIENTO	5441	-31.9133069	-68.3724361	4307973	R
255	DOMINGUITO 	S/N	COCHAGUAL	SARMIENTO	5441	-31.92148	-68.4086232	4302077	R
256	CIRCUITO FIORITO	S/N	CAMPO VID	SARMIENTO	5441	-32.0206856	-68.3929344	4302176	R
257	MENDOZA VIEJA Y LAMADRID	S/N	COLONIA FISCAL	SARMIENTO	5441	-31.9489798	-68.475002	4302164	R
258	S. MARIA DEL CARRIL 	S/N	COLONIA FISCAL	SARMIENTO	5441	-31.9028263	-68.4743715	4302104	R
259	RUTA PROVINCIAL 901 	S/N	DIVISADERO	SARMIENTO	5441	-32.0012738	-68.6965943	4302089	R
260	MENDOZA Y BUENOS AIRES	S/N	HUANACACHE	SARMIENTO	5441	-32.0639866	-68.5903232	4302123	R
261	BUFANO Y LLOVERAS	S/N	LAS LAGUNAS	SARMIENTO	5441	-32.0431431	-68.3676214	4302081	R
262	ALFREDO BUFANO 	S/N	LAS LAGUNAS	SARMIENTO	5441	-32.1027596	-68.3879547	4302105	R
263	2 DE ABRIL Y CATTANI	S/N	BÂ° ARAMBURU 	RIVADAVIA	5407	-31.5157902	-68.566329	4302106	O
264	CALLE 9 DE JULIO Y SARMIENTO	S/N	LOS BERROS	SARMIENTO	5441	-31.9523685	-68.6507079	4302108	R
265	9 DE JULIO 	S/N	VÂ° MEDIA AGUA	SARMIENTO	5441	-31.986333	-68.4224243	No registrado	R
266	9 DE JULIO 	S/N	VÂ° MEDIA AGUA	SARMIENTO	5441	-31.9824884	-68.4273137	4307976	R
267	AVENIDA 25 DE MAYO Y CIRTUITO FIORITO	S/N	VÂ° MEDIA AGUA	SARMIENTO	5441	-32.0200198	-68.4245887	4302093	R
268	BELGRANO	418	VÂ° MEDIA AGUA	SARMIENTO	5441	-31.9820546	-68.4263832	4307974	R
269	9 DE JULIO Y URUGUAY	S/N	VÂ° MEDIA AGUA	SARMIENTO	5441	-31.9823504	-68.4275826	4307977	R
270	AV. 25 DE MAYO	S/N	VÂ° MEDIA AGUA	SARMIENTO	5441	-31.991628	-68.4243482	4307975	R
271	RUTA 351	S/N	RETAMITO	SARMIENTO	5441	-32.0932746	-68.619402	4302115	R
272	RUTA NAC. NÂº 40 - KM 99	S/N	SAN CARLOS	SARMIENTO	5441	-32.1024482	-68.4594331	4302118	R
273	ARANDA Y 25 DE MAYO	S/N	TRES ESQUINAS	SARMIENTO	5441	-32.0598725	-68.4298959	4302090	R
274	VALENTIN RUIZ 	S/N	VILLA IBANEZ	ULLUM	5409	-31.4619213	-68.736602	4307713	O
275	SANTIAGO DEL ESTERO 	S/N	ULLUM	ULLUM	5409	-31.4628296	-68.7360441	4307705	O
276	R. QUIROGA Y 9 DE JULIO	S/N	VILLA AURORA	ULLUM	5409	-31.473614	-68.7458265	4307815	O
277	RUTA PROVINCIAL NÂ°510	S/N	AGUA CERCADA	VALLE FERTIL	5449	-30.8041513	-67.3664482	4302011	M
278	SIERRAS DE RIVEROS 	S/N	ASTICA	VALLE FERTIL	5449	-30.9137669	-67.3996855	No registrado	M
279	SIERRAS DE ELIZONDO	S/N	SIERRAS DE ELIZONDO	VALLE FERTIL	5449	-30.9444056	-67.4343154	No registrado	M
280	SAN PEDRO Y FELIPE COSTA	S/N	ASTICA	VALLE FERTIL	5449	-30.9543958	-67.3011705	4307780	M
281	RUTA PROVINCIAL NÂ°510 KM. 56	S/N	LOS BALDECITOS	VALLE FERTIL	5449	-30.2214946	-676941836	4302020	M
282	RUTA 503	S/N	BALDES DE ASTICA	VALLE FERTIL	5449	-30.9344142	-67.2498234	4302041	M
283	RUTA PROVINCIAL NÂ°511	S/N	BALDES DE LAS CHILCAS	VALLE FERTIL	5449	-30.6420455	-67.4085444	4302010	M
284	BALDES DEL NORTE	S/N	BALDES DEL NORTE	VALLE FERTIL	5449	-30.586337	-67.4256309	4302048	M
285	RUTA PROVINCIAL 510	S/N	BALDES DE ROSARIO	VALLE FERTIL	5449	-30.3219301	-67.6967477	4302019	M
286	RUTA NÂ° 506	S/N	BALDES DEL SUR	VALLE FERTIL	5449	-30.6929047	-67.3891637	4302001	M
287	SAN PEDRO Y FELIPE COSTA	S/N	CHUCUMA	VALLE FERTIL	5449	-31.0702033	-67.2816864	4302024	M
288	RUTAS 523	S/N	LOS BRETES	VALLE FERTIL	5449	-30.7671051	-67.4760113	4302021	M
289	LOS VALENCIANOS 	S/N	COLONIA LOS VALECIANOS	VALLE FERTIL	5449	-30.6132672	-67.4151067	4302031	M
290	CALLE QUIROGA Y RUTA NAC. 510	S/N	USNO	VALLE FERTIL	5449	-30.5667284	-67.54147	4302004	M
291	MITRE Y RAWSON	1741	VILLA SAN AGUSTIN	VALLE FERTIL	5449	-30.6375056	-67.4574392	4302015	M
292	MITRE Y GENERAL ACHA	S/N	VILLA SAN AGUSTIN	VALLE FERTIL	5449	-30.6355	-67.4671386	4307992	M
293	TUCUMAN 	S/N	VILLA SAN AGUSTIN	VALLE FERTIL	5449	-30.6278084	-67.4641121	4302033	M
294	LA MAJADITA	S/N	LA MAJADITA	VALLE FERTIL	5449	-30.681558	-67.5058668	4302023	M
295	SIERRAS DE CHAVEZ	S/N	SIERRAS DE CHAVEZ	VALLE FERTIL	5449	-30.8750667	-67.5395896	No registrado	M
296	LAS JUNTAS	S/N	LAS JUNTAS	VALLE FERTIL	5449	-30.7288525	-67.5866952	No registrado	M
297	HUELLA	S/N	BALDES DE FUNE	VALLE FERTIL	5449	-31.0741542	-67.1175215	4307968	M
298	HUELLA	S/N	BAJO CHUCUMA	VALLE FERTIL	5449	-31.2016194	-67.1663657	4302050	M
299	CALLE 6 ENTRE RUTA 270 Y CALLE 20	S/N	VILLA SANTA ROSA	25 DE MAYO	5443	-31.7724677	-68.306801	4307951	Y
300	CALLE 3 ENTRE LA PLATA Y SAN ISIDRO	S/N	CUATRO ESQUINAS	25 DE MAYO	5443	-31.7308284	-68.3451267	4307877	Y
301	ENFERMERA MEDINA ENTRE DIVISORIA Y UNO	S/N	DIVISORIA	25 DE MAYO	5443	-31.7016239	-68.3140829	4307962	Y
302	CALLE 2 ENTRE MEDINA Y RUTA 270	S/N	DIVISORIA	25 DE MAYO	5443	-31.7238164	-68.3152247	4307963	Y
303	RUTA NÂ°20	S/N	ENCON	25 DE MAYO	5443	-32.2163893	-67.7949775	4302170	Y
304	SAN LORENZO	S/N	25 DE MAYO	25 DE MAYO	5443	-31.8309785	-68.26223	No registrado	Y
305	RUTA 20 KM 910 ESTACION JOSE MARTI	S/N	LA CHIMBERA	25 DE MAYO	5443	-31.8302443	-68.2260992	4307950	Y
306	RUTA NÂ° 279 ENTRE CALLES 21 Y 22	S/N	LA CHIMBERA	25 DE MAYO	5443	-31.8232745	-68.2915523	4307950	Y
307	SAN ANTONIO PUESTO LOS CALDERONES	S/N	LAS TRANCAS	25 DE MAYO	5443	-32.2949658	-67.2808424	4302219	Y
308	RUTA 279 (ENTRE 20 Y RUTA 270)	S/N	LAS CASUARINAS	25 DE MAYO	5443	-31.8168204	-68.3239681	4307957	Y
309	CALLE 9 Y LA PLATA	S/N	LAS CASUARINAS	25 DE MAYO	5443	-31.8001316	-68.352429	4307959	Y
310	CALLE 7 Y 21	S/N	LAS CASUARINAS	25 DE MAYO	5443	-31.7861458	-68.2940294	4307955	Y
311	DIVISORIA ENTRE CALLES 22 Y 23	S/N	POZO SALADO	25 DE MAYO	5443	-31.7120575	-68.2459512	4307949	Y
312	CALLE 4  ENTRE CALLES 23 Y 24	S/N	POZO SALADO	25 DE MAYO	5443	-31.7586234	-68.2491467	4307948	Y
313	CALLES 2 Y 22	S/N	LA CHIMBERA	25 DE MAYO	5443	-31.7324925	-68.2665214	4307947	Y
314	RUTA 308	S/N	PUNTA DEL AGUA	25 DE MAYO	5443	-32.0356309	-68.2103835	4302195	Y
315	25 DE MAYO ENTRE SARMIENTO Y A TORRES	S/N	VILLA SANTA ROSA	25 DE MAYO	5443	-31.7430468	-68.3135998	4307961	Y
316	LA PLATA ENTRE 6 Y 7	S/N	VILLA SANTA ROSA	25 DE MAYO	5443	-31.7648758	-68.3438215	4307960	Y
317	MALVINAS ARGENTINAS Y M. BELGRANO	S/N	TUPELI	25 DE MAYO	5443	-31.8375454	-68.3587715	4307952	Y
318	25 DE MAYO Y MITRE	S/N	SANTA ROSA	25 DE MAYO	5443	-31.7470435	-68.3143616	4307958	Y
319	MATIAS SANCHEZ	S/N	ZONDA	ZONDA	5401	-31.5448573	-68.7521989	4307719	O
320	RUTA 12 KM 24 - NÂ° 24	24	VÂ° BASILIO NIEVAS	ZONDA	5401	-31.552246	-68.7300178	4307713	O
321	GRAN CHINA 	S/N	VILLA MERCEDES	JACHAL	5460	-30.121475	-68.7210862	4302006	G
322	VICUNA LARRAIN	S/N	EL RINCON	JACHAL	5460	-30.2498581	-68.719879	4302071	G
323	PRINCIPAL 	S/N	ZONDA	IGLESIA	5467	-30.3909131	-69.2107293	4302158	L
324	PUBLICA	S/N	PEDERNAL	SARMIENTO	5441	-31.9969837	-68.7650366	4302111	R
325	LAPRIDA Y PROYECTADA	S/N	VÂ° MEDIA AGUA	SARMIENTO	5441	-31.9863297	-68.4228681	4302465	R
326	9 Y LAS PIEDRITAS	S/N	QUINTO CUARTEL	POCITO	5427	-31.6264518	-68.6094464	4307634	R
327	AV. ROQUE SAENZ PENA	2930	SANTA LUCIA	SANTA LUCIA	5411	-31.5292194	-68.4914432	4307700	P
328	PATRICIAS SANJUANINAS Y CoRDOBA	S/N	VILLA SAN AGUSTIN	VALLE FERTIL	5449	-30.6400528	-67.4572349	4302043	M
329	RUTA 40	S/N	VILLA MARIANO MORENO	CHIMBAS	5413	-31.4654021	-68.5186562	4307858	S
330	NACIONAL ENTRE LA LAJA Y TUCUMAN	593	VILLA SAN MARTIN	ALBARDON	5419	-31.4280784	-68.5016769	4307757	S
331	BANDERA ARGENTINA	690	BÂº CHIMBAS II	CHIMBAS	5413	-31.5027764	-68.5238375	4307818	S
332	RUTA PROVINCIAL NÂº 270 	S/N	CAUCETE	CAUCETE	5442	-31.652246	-68.2879417	4302151	F
333	GUEMES Y YAPEYU 	2980	CAPITAN LAZO	RAWSON	5406	-31.5655244	-68.5393807	4307660	R
334	ALVEAR	3290	VILLA KRAUSE	RAWSON	5406	-31.5718442	-68.534032	4307658	R
335	JUAN JOSE PASO 	1300	BÂ° 12 DE DICIEMBRE	RAWSON	5406	-31.5706772	-68.5641281	4307822	R
336	JOSE MARIA PAZ Y MAGALLANES	S/N	VILLA SAN DAMIAN	RAWSON	5406	-31.5766738	-68.5575157	4307825	R
337	MALIMAN	S/N	MALIMAN	IGLESIA	5467	-29.9589244	-69.1793254	4302155	L
338	CALLE PRINCIPAL - EL LLANO ALEGRE	S/N	LAS FLORES	IGLESIA	5467	-30.3085912	-69.2195926	4302117	L
339	PRINCIPAL	S/N	PISMANTA	IGLESIA	5467	-30.2763272	-69.2295762	4302117	L
340	CATAMARCA	96	CAPITAL	CAPITAL	5400	-31.5335493	-68.53051	4307550	C
341	AV. LIB. GRAL. SAN MARTIN	7437	MARQUEZADO	RIVADAVIA	5407	-31.5259428	-68.6314138	4307834	O
342	SALTA	1750	VILLA UNION	CHIMBAS	5413	-31.4931081	-68.5462395	4307651	S
343	MITRE Y PATRICIAS SANJUANINAS	S/N	VILLA SAN AGUSTIN	VALLE FERTIL	5449	-30.6372722	-67.4590927	4307994	M
344	RUTA NÂ° 40 Y CALLEJON CANTONI	S/N	CARPINTERIA	POCITO	5427	-31.8584657	-68.5341476	4302378	R
345	PRESIDENTE ROCA /SN 	S/N	BARREAL	CALINGASTA	5403	-31.6546925	-69.4771742	4307899	T
346	RECONQUISTA	5760	VILLA SARMIENTO	CHIMBAS	5413	-31.4994579	-68.5313637	4307617	S
347	MANUEL LEMOS Y 6 	S/N	VILLA AEROPARQUE	POCITO	5427	-31.5974153	-68.5554872	4307635	R
348	AGUSTIN GOMEZ	163	TRINIDAD	CAPITAL	5400	-31.5524766	-68.5216286	4307505	C
349	MENDOZA	855	VILLA KRAUSE	RAWSON	5406	-31.5702492	-68.5308615	4307859	R
350	SAN ISIDRO	S/N	SAN ISIDRO	JACHAL	5460	-30.1404559	-68.7000765	4302056	G
351	GENERAL ACHA	466	CAPITAL	CAPITAL	5400	-31.5398477	-68.5239393	4302169	C
352	JUAN BAUSTISTA ALBERDI 	S/N	BELLA VISTA	JACHAL	5460	-30.2094452	-68.746564	4302064	G
353	RUTA NÂ° 40 KM 297 - LAS AGUADITAS	S/N	NIQUIVIL	JACHAL	5460	-30.4294016	-68.6817304	4302061	G
354	CLEMENTE SARMIENTO 	S/N	LA BEBIDA	RIVADAVIA	5407	-31.5543143	-68.6112501	4307812	O
355	JUAN JOSE BUSTOS 	S/N	DIVISORIA	CAUCETE	5442	-31.7027075	-68.285323	4302100	F
356	NUEVA A 3 5KM DE RUTA	S/N	CARPINTERIA	POCITO	5427	-31.7756401	-68.5157233	4307633	R
357	AV. LIB. GRAL. SAN MARTIN	5401	HOSPITAL MARCIAL QUIROGA	RIVADAVIA	5407	-31.5301118	-68.5961674	4307857	C
358	LA LAJA ENTRE RECABARREN Y PALACIO	4901	LAS LOMITAS	ALBARDON	5419	-31.3936218	-68.4853358	4307751	S
359	AVENIDA BENAVIDEZ	S/N	MARQUEZADO	RIVADAVIA	5407	-31.5167343	-68.5980836	4307813	O
360	HERMOGENEZ RUIZ	S/N	ULLUM	ULLUM	5409	-31.4693984	-68.7393091	4307749	O
361	LAPRIDA Y JUAN PABLO II	S/N	RODEO	IGLESIA	5467	-30.2153749	-69.1442466	4302112	L
362	CALLE 20 ENTRE CALLE 13 Y 16	S/N	LAS CASUARINAS	25 DE MAYO	5443	-31.8611114	-68.3230879	4307953	Y
363	PEDRO ECHAGUE Y 4 DE DICIEMBRE	S/N	SANTA LUCIA	SANTA LUCIA	5411	-31.5286848	-68.4986381	4307695	P
364	AV. RIOJA Y CIRCUNVALACION	1457	CAPITAL	CAPITAL	5400	-31.5167802	-68.5232218	4307545	C
365	CENTENARIO 	S/N	VILLA PAULA	CHIMBAS	5413	-31.4766419	-68.51141	4307796	S
366	ALFREDO FORTABAT	3070	BÂ° FRANKLIN RAWSON	RAWSON	5406	-31.5719334	-68.5751717	4302049	R
367	RAWSON Y SAN MARTIN	S/N	SAN JOSE DE JACHAL	JACHAL	5460	-30.2429465	-68.7446062	No registrado	G
368	ALVEAR	3979	RAWSON	RAWSON	5406	-31.5735174	-68.5356583	No registrado	R
369	TUCUMAN	1040	CONCEPCION	CAPITAL	5400	-31.5209243	-68.5238271	4307608	R
370	AV. PAULA A. DE SARMIENTO Y VICEGDOR LUIS CATTANI	S/N	RIVADAVIA	RIVADAVIA	5407	-31.5152672	-68.5645681	4307596	O
371	AV. PAULA ALBARRACIN DE SARMIENTO	425	CAPITAL	CAPITAL	5400	-31.5347691	-68.5531388	4307605	B
372	MARADONA	2321	BÂ° GUEMES	CHIMBAS	5413	-31.4924978	-68.5512473	4307846	S
373	SARMIENTO	S/N	VILLA DEL SALVADOR	ANGACO	5415	-31.4511457	-68.4035333	4302221	S
374	GUILLERMO RAWSON	S/N	VILLA DEL SALVADOR	ANGACO	5415	-31.4481695	-68.405568	4307730	S
375	PROYECTADA 	S/N	CAMPO AFUERA	ALBARDON	5419	-31.4214972	-68.5391203	4307985	S
376	PROYECTADA Y OBRERO MUNICIPAL	S/N	CAMPO AFUERA	ALBARDON	5419	-31.5044292	-68.3617209	4302223	P
377	CALLEJON SORIA	S/N	VILLA SAN MARTIN	ALBARDON	5419	-31.4355471	-68.5136597	No registrado	S
378	SIN DATOS	S/N	CHIMBAS	CHIMBAS	5413	0	0	No registrado	S/D
379	SEGOVIA ESQUINA COMBATE DE SAN LORENZO	S/N	VILLA EL SALVADOR	ANGACO	5415	-31.4517567	-68.4038065	4302351	S
380	EVA PERON Y L.N.ALEM	S/N	VILLA DEL SALVADOR	ANGACO	5415	-31.456933	-68.4091945	4307726	S
381	21 DE FEBRERO  ENTRE NACIONAL Y ZAPATA	S/N	LAS TAPIAS	ANGACO	5415	-31.4060825	-68.4146123	4307868	S
382	21 DE FEBRERO PASANDO BELGRANO	S/N	LAS TAPIAS	ANGACO	5415	-31.4070049	-68.3396741	4307867	S
383	CALLE AGUILERA Y ZAPATA	S/N	PLUMERILLO	ANGACO	5415	-31.4449151	-68.4263956	4307724	S
384	HIPoLITO IRIGOYEN 	S/N	BARREAL	CALINGASTA	5403	-31.6539667	-69.4769252	4307746	T
385	JUAN JUFRE 	S/N	VILLA CALINGASTA	CALINGASTA	5403	-31.3331844	-69.4218933	4307734	T
386	ANTONIO DE LA TORRE Y RODOLFO PAEZ ORO	S/N	BÂ° FRONDIZI	CAPITAL	5400	-31.5076944	-68.5126388	4302342	C
387	MENDOZA ENTRE 25 DE MAYO Y SAN LUIS	S/N	CAPITAL	CAPITAL	5400	-31.5328542	-68.5263746	4307514	B
388	AV. ALEM	527	CAPITAL	CAPITAL	5400	-31.54110249	-68.53158069	No registrado	S/D
389	JAIME GUARDIOLA	S/N	CAUCETE	CAUCETE	5442	-31.6664032	-68.2691819	4302303	F
390	CASAS VIEJAS	S/N	CASAS VIEJAS	CAUCETE	5442	-31.3772151	-67.8034246	No registrado	F
391	SAN MARTIN Y CORDOBA	S/N	CAUCETE	CAUCETE	5442	-31.6550351	-68.2840738	No registrado	F
392	JAIME BORONET Y CORREA	S/N	BÂº BERMEJO	CAUCETE	5442	-31.6659283	-68.269147	4302299	F
393	25 DE MAYO  Y PROYECTADA NÂº 5	S/N	CHIMBAS	CHIMBAS	5413	-31.4986407	-68.5696887	No registrado	S
394	CALLE PROYECTADA 	S/N	BÂ° CENTENARIO	CHIMBAS	5413	-31.4930613	-68.5461778	No registrado	O
395	TAMBOR DE TACUARI M:L	18	CHIMBAS	CHIMBAS	5413	-31.5053718	-68.5907004	4307841	O
396	LOPEZ MANSILLA	S/N	VILLA DEL SALVADOR	CHIMBAS	5413	-31.5099051	-68.534631	4307624, 4307929	S
397	ALEM	S/N	  BÂº NORTE	CHIMBAS	5413	-31.4950121	-68.543604	4307619	S
398	MENDOZA	2371	CHIMBAS NORTE	CHIMBAS	5413	-31.4798101	-68.5317716	No registrado	S
399	NECOCHEA	1514	CHIMBAS	CHIMBAS	5413	-31.5010235	-68.5084387	4302460	S
400	NEUQUEN	S/N	BÂ° LOS TAMARINDO	CHIMBAS	5413	-31.4986182	-68.5699959	4302371	S
401	GOBERNADOR ROJAS	998	CHIMBAS	CHIMBAS	5413	-31.4996412	-68.5305766	No registrado	S
402	GRECO Y SANTA CRUZ	S/N	BÂ° LOS ANDES	CHIMBAS	5413	-31.5020337	-68.5135984	4307849	S
403	SANTAFE Y ESMERALDA	774	CHIMBAS	CHIMBAS	5413	-31.5070132	-68.5230908	No registrado	S
404	BELGRANO Y MALVINAS ARGENTINAS ENTRE BEL. Y M. ARG	S/N	ANGUALASTO	IGLESIA	5467	-30.0543387	-69.173277	No registrado	L
405	SANTO DOMINGO	4125	RODEO	IGLESIA	5467	-30.211636	-69.136567	4302397	L
406	JUAN DOMINGO PERON	S/N	RODEO	IGLESIA	5467	-30.2116046	-69.1366196	4302122	L
407	RIVADAVIA	854	SAN JOSE DE JACHAL	JACHAL	5460	-30.2429906	-68.7497953	4302014	G
408	PROYECTADA ENTRE CALLE 1 Y 2	S/N	BÂ° SAN JOSE	JACHAL	5460	-30.2432969	-68.7544364	4302307	G
409	LAPRIDA	S/N	VILLA 9 DE JULIO	9 DE JULIO	5417	-31.6687829	-68.3910906	No registrado	P
410	ATENCIO Y PROYECTADA	S/N	POCITO	POCITO	5427	-31.649094	-68.5819234	4302181, 4307685	R
411	CHACABUCO Y COSTA CANAL	S/N	QUINTO CUARTEL	POCITO	5427	-31.7756401	-68.5157233	4307682	R
412	FRIAS	4750	POCITO NORTE	POCITO	5427	-31.5855733	-68.5547264	4302227	R
413	VIDART (ENTRE 6 Y CALLE 51)	S/N	POCITO	POCITO	5427	-31.5982337	-68.5715233	4307795	R
414	MENDOZA Y CALLE 14	S/N	RINCONADA	POCITO	5427	-31.6903471	-68.5726332	4302928	R
415	ALFONSINA STORNI Y MAURIN	S/N	VILLA ABERASTAIN	POCITO	5427	-31.6579109	-68.58372	4302274	R
416	DR. ORTEGA Y FRANCIA	S/N	RAWSON	RAWSON	5406	-31.5701986	-68.5617464	No registrado	R
417	RAMELA ENTRE ANTONIO DE LA TORRE Y SANTIAGO PAREDES	S/N	 BÂº BORGES	RAWSON	5406	-31.5571487	-68.5080053	4307687	R
418	PROGRESO Y BALMACEDA	S/N	 BÂº SIERRAS MORADAS	RAWSON	5406	-31.5838297	-68.5054271	No registrado	R
419	S/N	S/N	BÂº VALLE GRANDE	RAWSON	5406	-31.5674185	-68.5999552	4302414	R
420	BOULEVARD SARMIENDO Y CONECTOR SUR	S/N	BÂº LA ESTACION	RAWSON	5406	-31.5798272	-68.5504467	4307827	R
421	QUIROZ Y CALINGASTA	S/N	BÂ° 24 DE NOVIEMBRE	RAWSON	5406	-31.5838889	-68.5322162	4302374	R
422	MENDOZA	3712	VILLA KRAUSE	RAWSON	5406	-31.5786689	-68.5321854	4307767	R
423	CHUBUT Y SANTA CRUZ	S/N	LA BEBIDA	RIVADAVIA	5407	-31.5393684	-68.6298094	4307611	O
424	COSTA CANAL	1050	BÂ° MARQUESADO	RIVADAVIA	5407	-31.5141622	-68.6168452	4302304	O
425	JORGE LUIS BORGES	S/N	BÂº NATANIA XV	RIVADAVIA	5407	-31.5349911	-68.6006367	4307600	O
426	RASTREADOR CALIVAR Y REPUBLICA DEL LIBANO    	S/N	BÂ° PIUQUEN	RIVADAVIA	5407	-31.5489218	-68.5901024	4302293	O
427	PROYECTADA Y COMERCIO 	S/N	BÂ° PIUQUEN	RIVADAVIA	5407	-31.5465887	-68.625517	4302314	O
428	AV. NAZARIO BENAVIDEZ	7500	RIVADAVIA	RIVADAVIA	5407	-31.5105376	-68.6198533	No registrado	O
429	RAWSON 	S/N	VILLA ALEM	SAN MARTIN	5439	-31.5550129	-68.3350067	4302094	P
430	RUTA NÂ° 295 PUNTA DEL MEDANO	S/N	COCHAGUAL	SARMIENTO	5441	-31.9560651	-68.6598561	4302092, 4302119	R
431	RUTA NÂ° 295 PUNTA DEL MEDANO	S/N	COCHAGUAL	SARMIENTO	5441	-31.8933822	-68.4163483	4302076	R
432	CHUBUT	S/N	LOS BERROS	SARMIENTO	5441	-31.9527214	-68.6558883	4302080	R
433	H. IRIGOYEN	5260	LA LEGUA	SANTA LUCIA	5411	-31.5542342	-68.4678385	4307565	P
434	BALCARCE	2262	COLONIA GUTIERREZ	SANTA LUCIA	5411	-31.510173	-68.4649571	4307580	P
435	CARLOS LENCINA ESTE Y AV. DE CIRCUNVALACION	S/N	SANTA LUCIA	SANTA LUCIA	5411	-31.5464989	-68.5026573	4307525	P
436	GORRITI Y LOS ALMENDROS	S/N	SANTA LUCIA	SANTA LUCIA	5411	-31.5439444	-68.4956167	4307697	P
437	SOLDADO ARGENTINO Y ROSARIO QUIROGA	S/N	VILLA AURORA	ULLUM	5409	-31.4731085	-68.7461025	4302441	O
438	CALLE 20 ENTRE 13 Y 14	S/N	CAMPOS DE AIBILi	25 DE MAYO	5443	-31.82666086	-68.2455383	4307954	Y
439	RUTA PROVINCIAL NÂº 279 ENTRE CALLE SAN MARTIN Y 20	S/N	25 DE MAYO	25 DE MAYO	5443	-31.8184341	-68.3269739	4307956	Y
440	CALLE 4 Y ENFERMERA MEDINA	S/N	VILLA SANTA ROSA	25 DE MAYO	5443	-31.7453826	-68.3247523	No registrado	Y
441	ENFERMERA MEDINA	S/N	VILLA SANTA ROSA	25 DE MAYO	5443	-31.7423479	-68.3135138	4302489	Y
442	PATRICIAS SANJUANINAS Y CoRDOBA	S/N	VILLA SAN AGUSTIN	VALLE FERTIL	5449	-30.6408358	-67.4573412	4302271	M
443	FRAY JUSTO SANTA MARIA DE ORO 	S/N	ZONDA	ZONDA	5401	-31.5367965	-68.7154811	4307702	O
444	AV. ARGENTINA Y GuEMES	S/N	ZONDA	ZONDA	5401	-31.5489539	-68.7325821	4307714	O
445	FLORIDA	2582	RAWSON	RAWSON	5425	-31.56082	-68.55826	2644340048	V
446	SANTA MARIA DE ORO	116	VILLA GENERAL SAN MARTIN	ALBARDON	5419	-31.43996	-68.52117	2644911091	V
447	SEGOVIA	692	VILLA DEL SALVADOR	ANGACO	5415	-31.453	-68.40485	2644972016	V
448	DOMINGO FAUSTINO SARMIENTO	S/N	VILLA DEL SALVADOR	ANGACO	5439	-31.44313	-68.44035	26454528787	V
449	PRESIDENTE ROCA	180	BARREAL	CALINGASTA	5405	-31.64201	-69.47166	2644859487	V
450	SAN LUIS	139	CAPITAL	CAPITAL	5400	-31.53302	-68.52435	2644211809	V
451	AV. LIBERTADOR	1847	CAPITAL	CAPITAL	5400	-31.53122	-68.55156	264231531	V
452	ENTRE RIOS	744	CAPITAL	CAPITAL	5400	-31.54329	-68.52644	2644214128	V
453	AV. IGNACIO DE LA ROZA	1160	CAPITAL	CAPITAL	5400	-31.53766	-68.54372	264220082	V
454	SAN LUIS	537	CAPITAL	CAPITAL	5400	-31.53346	-68.53428	2644225585	V
455	AV. LIBERTADOR 96	96	CAPITAL	CAPITAL	5400	-31.53529	-68.52694	2644320383	V
456	RIVADAVIA	47	CAPITAL	CAPITAL	5400	-31.53634	-68.52647	2644202622	V
457	SARMIENTO	378	CAPITAL	CAPITAL	5400	-31.52994	-68.52954	2644212250	V
458	BRASIL	2661	CAPITAL	CAPITAL	5400	-31.54479	-68.56196	2644264369	V
459	9 DE JULIO	678	CAPITAL	CAPITAL	5400	-31.5417	-68.516	2644201948	V
460	ESTADOS UNIDOS	601	CAPITAL	CAPITAL	5400	-31.54059	-68.51174	2644224666	V
461	BRASIL	1051	CAPITAL	CAPITAL	5400	-31.54286	-68.51128	2644218772	V
462	TUCUMAN	315	CAPITAL	CAPITAL	5400	-31.53032	-68.52344	2644203963	V
463	TUCUMAN	328	CAPITAL	CAPITAL	5400	-31.52227	-68.52288	2644111120	V
464	AV. RIOJA	1517	CAPITAL	CAPITAL	5400	-31.51723	-68.52312	2644214322	V
465	GRAL. ACHA	1211	CAPITAL	CAPITAL	5400	-31.55007	-68.52314	2644224800	V
466	AV. IGNACIO DE LA ROZA	2033	CAPITAL	CAPITAL	5400	-31.53772	-68.55433	2644234320	V
467	SEGUNDINO NAVARRO	1163	CAPITAL	CAPITAL	5400	-31.54829	-68.54159	2644277283	V
468	9 DE JULIO	809	CAPITAL	CAPITAL	5400	-31.54199	-68.51416	2644216144	V
469	25 DE MAYO	430	CAPITAL	CAPITAL	5400	-31.53116	-68.52025	2644229971	V
470	AV. LEANDRO ALEM	538	CAPITAL	CAPITAL	5400	-31.54132	-68.53113	2644214580	V
471	LA PAZ	215	VILLA GENERAL SAN MARTIN	ALBARDON	5419	-31.43414	-68.52787	2645268770	v
472	SAN LUIS	235	CAPITAL	CAPITAL	5400	-31.53326	-68.52956	2644228325	V
473	SAN LUIS	247	CAPITAL	CAPITAL	5400	-31.53327	-68.52968	2644212135	V
474	MATIAS ZAVALLA	57	CAPITAL	CAPITAL	5400	-31.53175	-68.54965	No registrado	V
475	JUSTO JOSE URQUIZA	374	DESAMPARADOS	CAPITAL	5400	-31.53829	-68.54482	2644203855	V
476	AV. ESPANA	309	CAPITAL	CAPITAL	5400	-31.53134	-68.53689	2644202588	V
477	AV. RAWSON	471	CAPITAL	CAPITAL	5400	-31.53919	-68.51479	2644210723	V
478	GRAL. PAZ 346 (O) CP:J5400	346	CAPITAL	CAPITAL	5400	-31.54195	-68.53025	2644222262	V
479	CHILE	469	CAPITAL	CAPITAL	5400	-31.52621	-68.52035	2644201520	V
480	GRAL. ACHA	1501	TRINIDAD (CAP)	CAPITAL	5400	-31.55427	-68.52278	2644201620	V
481	AV. LIBERTADOR	1840	CAPITAL	CAPITAL	5400	-31.53056	-68.5517	2644260286	V
482	ALVEAR	84	CAPITAL	CAPITAL	5400	-31.53052	-68.55131	2644262364	V
483	AV. IGNACIO DE LA ROZA	2574	CAPITAL	CAPITAL	5400	-31.5385	-68.56236	2644230596	V
484	SANTA FE	136	CAPITAL	CAPITAL	5400	-31.53923	-68.52738	No registrado	V
485	SATURNINO SARASSA	256	CAPITAL	CAPITAL	5400	-31.553	-68.52016	2644218963	V
486	CATAMARCA	147	CAPITAL	CAPITAL	5400	-31.53624	-68.5305	2644272483	V
487	GRAL. ACHA	426	CAPITAL	CAPITAL	5400	-31.5392	-68.52399	2644202223	V
488	MAIPU	253	CAPITAL	CAPITAL	5400	-31.52959	-68.56055	2644212250	V
489	AV. CORDOBA	266	CAPITAL	CAPITAL	5400	-31.53979	-68.52968	2644228987	V
490	ABERASTAIN	22	CAPITAL	CAPITAL	5400	-31.53384	-68.5188	2644221047	V
491	SAN MARTIN	1120	CAPITAL	CAPITAL	5400	-31.54478	-68.50799	2644213864	A
492	GRAL. PAZ	44	CAPITAL	CAPITAL	5400	-31.52606	-68.52041	2644201520	V
493	MATIAS ZAVALLA	205	CAPITAL	CAPITAL	5400	-31.53014	-68.54919	2644267743	V
494	LAPRIDA	348	CAPITAL	CAPITAL	5400	-31.54076	-68.52933	No registrado	V
495	TUCUMAN 575 (N) CP:5400	575	CAPITAL	CAPITAL	5400	-31.52662	-68.5238	2644215223	V
496	GUEMES	44	CAPITAL	CAPITAL	5400	-31.53518	-68.52718	2644229025	V
497	IGNACIO RODRIGUEZ	131	CAPITAL	CAPITAL	5400	-31.53512	-68.54423	2644221686	V
498	AV. CORDOBA	728	CAPITAL	CAPITAL	5400	-31.53934	-68.5156	2645297724	V
499	AV. CORDOBA	232	CAPITAL	CAPITAL	5400	-31.54017	-68.5221	2644220580	V
500	AV. PAULA ALBARRACIN DE SARMIENTO	255	CAPITAL	CAPITAL	5400	-31.53372	-68.55314	2644230560	V
501	JOAQUIN V. GONZALEZ	127	DESAMPARADOS	CAPITAL	5400	-31.52956	-68.56578	2644430595	v
502	SANTA FE 158, ESTE	158	CAPITAL	CAPITAL	5400	-31.53871	-68.5234	2644204544	v
503	ALVEAR	24	CAPITAL	CAPITAL	5400	-31.53155	-68.55107	No registrado	v
504	SANTA FE	295	CAPITAL	CAPITAL	5400	-31.53881	-68.52157	2644210306	v
505	LAPRIDA	54	CAPITAL	CAPITAL	5400	-31.53514	-68.52516	2645143803	v
506	25 DE MAYO	125	CAPITAL	CAPITAL	5400	-31.54691	-68.52506	2644220494	v
507	25 DE MAYO	959	CAPITAL	CAPITAL	5400	-31.53096	-68.54083	2644277512	V
508	ESTEBAN ECHEVERRIA	187	CAPITAL	CAPITAL	5400	-31.5304	-68.56344	2644261110	V
509	MATIAS ZAVALLA	205	CAPITAL	CAPITAL	5400	-31.53012	-68.54921	2646046066	v
510	MENDOZA	1640	BÂ° ANDACOLLO	CHIMBAS	5413	-31.49191	-68.53221	2644313622	V
511	NEUQUEN	103	CHIMBAS	CHIMBAS	5413	-31.50572	-68.53323	2644311922	V
512	FRAY JUSTO STA. MARIA DE ORO	291	VILLA ABERASTAIN (POC)	POCITO	5427	-31.65746	-68.58117	2644464115	V
513	BOULEVARD SARMIENTO	489	VILLA KRAUSE	RAWSON	5425	-31.51304	-68.50682	2644241505	V
514	MONSENOR ORZALI	S/N	BÂ° MONSENOR ORZALI	RAWSON	5425	-31.57182	-68.54076	2644285206	V
515	YAPEYU	824	BÂ° CAPITAN LAZO	RAWSON	5425	-31.56621	-68.53999	2644240448	V
516	HIOPLITO IRIGOYEN	1030	RAWSON	RAWSON	5425	-31.5576	-68.56812	2644342244	V
517	MENDOZA	3368	BÂ° RESIDENCIAL	RAWSON	5425	-31.57435	-68.5308	2644288230	V
518	SANTA ROSA Y SIVORI	S/N	VILLA KRAUSE	RAWSON	5425	-31.57756	-68.54106	2644816872	V
519	GENOVA	1501	RAWSON	RAWSON	5425	-31.55935	-68.53708	2644242222	V
520	COMANDANTE CABOT	112	RAWSON	RAWSON	5425	-31.55995	-68.52622	2644224134	V
521	CALVENTO	339	RAWSON	RAWSON	5425	-31.5797	-68.53821	2644281128	V
522	AV. LIBERTADOR GRAL. SAN MARTIN	5059	RIVADAVIA	RIVADAVIA	5407	-31.52957	-68.59056	2644332533	V
523	FLORENTINO AMEGUINO	334	CAPITAL	CAPITAL	5400	-31.53644	-68.54696	No registrado	v
524	25 DE MAYO	470	CAPITAL	CAPITAL	5400	-31.53229	-68.53317	2646609996	V
525	ARNOBIO SANCHEZ	1620	BÂ° PARQUE RIVADAVIA NORTE	RIVADAVIA	5407	-31.51369	-68.58481	2644234736	V
526	AV. IGNACIO DE LA ROZA	1516	RIVADAVIA	RIVADAVIA	5407	-31.52827	-68.57752	2644292366	V
527	CALLEJON DE LOS RIOS S/N	S/N	RIVADAVIA	RIVADAVIA	5407	-31.51192	-68.60207	2644234305	V
528	PABLO DMARCO	5756	BÂ° CAMUS	RIVADAVIA	5407	-31.53183	-68.59809	2644331198	V
529	AV. LIBERTADOR GRAL. SAN MARTIN	3880	RIVADAVIA	RIVADAVIA	5407	-31.5284	-68.57746	2644235013	V
530	AV. LIBERTADOR GENERAL SAN MARTIN	3880	RIVADAVIA	RIVADAVIA	5407	-31.5284	-68.57746	2644235013	V
531	HIPOLITO IRIGOYEN	1273	VILLA SAN FRANCISCO	RIVADAVIA	5400	-31.54342	-68.56649	2644266794	O
532	HIPOLITO IRIGOYEN	2269	RIVADAVIA	RIVADAVIA	5407	-31.553565	-68.56708	2644464977	A
533	SARGENTO CABRAL	4995	RIVADAVIA	RIVADAVIA	5407	-31.51571	-68.58803	2644212951	V
534	MEGLIOLI	372	BÂ° HAUZIHUL	RIVADAVIA	5407	-31.5294	-68.59425	2644237647	V
535	LOS ALAMOS	528	RIVADAVIA	RIVADAVIA	5407	-31.53361	-68.57909	2644836941	V
536	AV. RAWSON	S/N	LA PUNTILLA	SAN MARTIN	5439	-31.55386	-68.33936	2644971266	V
537	MARTINEZ LOPEZ	S/N	MEDIAGUA	SARMIENTO	5435	-31.98139	-68.42592	2644941538	V
538	RAMON FRANCO	2119	SANTA LUCIA	SANTA LUCIA	5411	-31.53876	-68.49735	2644253757	V
539	PELLEGRINI	3700	SANTA LUCIA	SANTA LUCIA	5411	-31.53997	-68.47811	2645124603	V
540	PELAGIO LUNA	312	SANTA LUCIA	SANTA LUCIA	5411	-31.53777	-68.49113	2644251289	V
541	SARMIENTO	1951	SANTA LUCIA	SANTA LUCIA	5411	-31.53663	-68.50011	2644253161	V
542	9 DE JULIO Y RAWSON	S/N	VILLA SANTA ROSA	25 DE MAYO	5443	-31.74376	-68.3152	2644978013	Y
543	AV. LEANDRO ALEM	758	CAPITAL	CAPITAL	5400	-31.543732516206365	-68.5310098164988		A
544	EL CEIBO Y LOS ZORZALES 	S/N	MARQUESADO	RIVADAVIA	5407	-31.513627	-68.614079		O
545	INTERNA 	S/N	BÂ° SANTA MARIA CONJUNTO 3	CHIMBAS	5413	-31.47594	-68.50784		S
\.


--
-- Data for Name: edificio; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.edificio (id_edificio, cui, id_direccion) FROM stdin;
1	7000001	1
2	7000003	2
3	7000006	3
4	7000007	4
5	7000009	5
6	7000010	6
7	7000011	7
8	7000012	8
9	7000013	9
10	7000014	10
11	7000015	11
12	7000016	12
13	7000017	13
14	7000019	14
15	7000020	15
16	7000021	16
17	7000022	17
18	7000024	18
19	7000026	19
20	7000027	20
21	7000029	21
22	7000031	22
23	7000032	23
24	7000033	24
25	7000034	25
26	7000035	26
27	7000036	27
28	7000037	28
29	7000041	29
30	7000042	30
31	7000043	31
32	7000044	32
33	7000045	33
34	7000046	34
35	7000047	35
36	7000049	36
37	7000050	37
38	7000052	38
39	7000053	39
40	7000054	40
41	7000055	41
42	7000056	42
43	7000057	43
44	7000058	44
45	7000059	45
46	7000060	46
47	7000061	47
48	7000062	48
49	7000063	49
50	7000064	50
51	7000065	51
52	7000066	52
53	7000086	53
54	7000088	54
55	7000089	55
56	7000090	56
57	7000091	57
58	7000093	58
59	7000094	59
60	7000095	60
61	7000097	61
62	7000098	62
63	7000101	63
64	7000102	64
65	7000106	65
66	7000107	66
67	7000109	67
68	7000110	68
69	7000113	69
70	7000114	70
71	7000115	71
72	7000116	72
73	7000117	73
74	7000118	74
75	7000119	75
76	7000125	76
77	7000126	77
78	7000128	78
79	7000129	79
80	7000133	80
81	7000134	81
82	7000135	82
83	7000136	83
84	7000137	84
85	7000138	85
86	7000139	86
87	7000141	87
88	7000142	88
89	7000143	89
90	7000144	90
91	7000145	91
92	7000146	92
93	7000147	93
94	7000148	94
95	7000150	95
96	7000151	96
97	7000152	97
98	7000153	98
99	7000155	99
100	7000156	100
101	7000157	101
102	7000158	102
103	7000159	103
104	7000160	104
105	7000161	105
106	7000162	106
107	7000163	107
108	7000165	108
109	7000166	109
110	7000168	110
111	7000170	111
112	7000171	112
113	7000172	113
114	7000174	114
115	7000175	115
116	7000177	116
117	7000178	117
118	7000180	118
119	7000181	119
120	7000184	120
121	7000185	121
122	7000186	122
123	7000187	123
124	7000190	124
125	7000191	125
126	7000192	126
127	7000193	127
128	7000194	128
129	7000195	129
130	7000197	130
131	7000198	131
132	7000199	132
133	7000200	133
134	7000201	134
135	7000202	135
136	7000203	136
137	7000204	137
138	7000206	138
139	7000207	139
140	7000208	140
141	7000209	141
142	7000210	142
143	7000211	143
144	7000212	144
145	7000214	145
146	7000215	146
147	7000216	147
148	7000217	148
149	7000218	149
150	7000219	150
151	7000220	151
152	7000221	152
153	7000222	153
154	7000223	154
155	7000224	155
156	7000225	156
157	7000226	157
158	7000227	158
159	7000228	159
160	7000229	160
161	7000230	161
162	7000232	162
163	7000233	163
164	7000234	164
165	7000235	165
166	7000237	166
167	7000239	167
168	7000240	168
169	7000241	169
170	7000242	170
171	7000243	171
172	7000244	172
173	7000245	173
174	7000246	174
175	7000247	175
176	7000248	176
177	7000249	177
178	7000250	178
179	7000251	179
180	7000252	180
181	7000253	181
182	7000255	182
183	7000256	183
184	7000257	184
185	7000258	185
186	7000259	186
187	7000260	187
188	7000261	188
189	7000263	189
190	7000265	190
191	7000267	191
192	7000268	192
193	7000269	193
194	7000272	194
195	7000273	195
196	7000274	196
197	7000275	197
198	7000276	198
199	7000277	199
200	7000278	200
201	7000279	201
202	7000280	202
203	7000283	203
204	7000284	204
205	7000285	205
206	7000286	206
207	7000289	207
208	7000290	208
209	7000291	209
210	7000292	210
211	7000293	211
212	7000294	212
213	7000300	213
214	7000301	214
215	7000302	215
216	7000303	216
217	7000304	217
218	7000306	218
219	7000309	219
220	7000311	220
221	7000312	221
222	7000315	222
223	7000317	223
224	7000319	224
225	7000322	225
226	7000323	226
227	7000324	227
228	7000325	228
229	7000326	229
230	7000327	230
231	7000328	231
232	7000329	232
233	7000330	233
234	7000331	234
235	7000332	235
236	7000333	236
237	7000334	237
238	7000335	238
239	7000336	239
240	7000337	240
241	7000338	241
242	7000340	242
243	7000341	243
244	7000342	244
245	7000343	245
246	7000344	246
247	7000345	247
248	7000347	248
249	7000349	249
250	7000350	250
251	7000351	251
252	7000352	252
253	7000353	253
254	7000355	254
255	7000356	255
256	7000357	256
257	7000358	257
258	7000359	258
259	7000361	259
260	7000362	260
261	7000363	261
262	7000364	262
263	7000365	263
264	7000366	264
265	7000368	265
266	7000369	266
267	7000370	267
268	7000371	268
269	7000372	269
270	7000373	270
271	7000374	271
272	7000375	272
273	7000376	273
274	7000378	274
275	7000379	275
276	7000380	276
277	7000382	277
278	7000383	278
279	7000384	279
280	7000385	280
281	7000386	281
282	7000387	282
283	7000388	283
284	7000389	284
285	7000390	285
286	7000391	286
287	7000392	287
288	7000393	288
289	7000394	289
290	7000395	290
291	7000396	291
292	7000397	292
293	7000398	293
294	7000399	294
295	7000400	295
296	7000401	296
297	7000402	297
298	7000403	298
299	7000404	299
300	7000405	300
301	7000406	301
302	7000407	302
303	7000408	303
304	7000410	304
305	7000411	305
306	7000412	306
307	7000413	307
308	7000414	308
309	7000416	309
310	7000417	310
311	7000418	311
312	7000419	312
313	7000420	313
314	7000421	314
315	7000422	315
316	7000423	316
317	7000424	317
318	7000426	318
319	7000427	319
320	7000430	320
321	7000435	321
322	7000436	322
323	7000438	323
324	7000439	324
325	7000440	325
326	7000441	326
327	7000664	327
328	7000794	328
329	7050002	329
330	7050028	330
331	7050035	331
332	7050038	332
333	7050041	333
334	7050043	334
335	7050047	335
336	7050054	336
337	7050063	337
338	7050068	338
339	7050069	339
340	7050086	340
341	7050105	341
342	7050135	342
343	7050153	343
344	7050177	344
345	7050194	345
346	7050206	346
347	7050253	347
348	7050260	348
349	7050281	349
350	7050300	350
351	7050312	351
352	7050364	352
353	7050367	353
354	7050376	354
355	7050399	355
356	7050402	356
357	7050423	357
358	7050437	358
359	7050439	359
360	7050442	360
361	7050444	361
362	7050445	362
363	7100001	363
364	7100005	364
365	7100013	365
366	7100017	366
367	7100064	367
368	7100067	368
369	7100068	369
370	7100076	370
371	7100099	371
372	7100101	372
373	7100106	373
374	7100111	374
375	PROV0101	375
376	PROV0102	376
377	PROV0103	377
378	PROV014	378
379	PROV0201	379
380	PROV0202	380
381	PROV0203	381
382	PROV0204	382
383	PROV0206	383
384	PROV0301	384
385	PROV0302	385
386	PROV0403	386
387	PROV0409	387
388	PROV0442	388
389	PROV0501	389
390	PROV0502	390
391	PROV0503	391
392	PROV0506	392
393	PROV0601	393
394	PROV0602	394
395	PROV0603	395
396	PROV0605	396
397	PROV0606	397
398	PROV0607	398
399	PROV0608	399
400	PROV0609	400
401	PROV0610	401
402	PROV0613	402
403	PROV0622	403
404	PROV0701	404
405	PROV0702	405
406	PROV0703	406
407	PROV0801	407
408	PROV0805	408
409	PROV0901	409
410	PROV1002	410
411	PROV1003	411
412	PROV1004	412
413	PROV1005	413
414	PROV1006	414
415	PROV1009	415
416	PROV1101	416
417	PROV1102	417
418	PROV1103	418
419	PROV1104	419
420	PROV1107	420
421	PROV1108	421
422	PROV1109	422
423	PROV1201	423
424	PROV1202	424
425	PROV1203	425
426	PROV1204	426
427	PROV1205	427
428	PROV1208	428
429	PROV1301	429
430	PROV1401	430
431	PROV1402	431
432	PROV1403	432
433	PROV1501	433
434	PROV1502	434
435	PROV1503	435
436	PROV1504	436
437	PROV1601	437
438	PROV1701	438
439	PROV1702	439
440	PROV1704	440
441	PROV1708	441
442	PROV1801	442
443	PROV1901	443
444	PROV1902	444
445	PROV1113	445
446	PROV0104	446
447	PROV0205	447
448	PROV0207	448
449	PROV0304	449
450	PROV0410	450
451	PROV0412	451
452	PROV0413	452
453	PROV0414	453
454	PROV0415	454
455	PROV0416	455
456	PROV0417	456
457	PROV0419	457
458	PROV0420	458
459	PROV0421	459
460	PROV0422	460
461	PROV0423	461
462	PROV0424	462
463	PROV0425	463
464	PROV0426	464
465	PROV0427	465
466	PROV0428	466
467	PROV0429	467
468	PROV0430	468
469	PROV0432	469
470	PROV0433	470
471	PROV0105	471
472	PROV0434	472
473	PROV0435	473
474	PROV0436	474
475	PROV0437	475
476	PROV0438	476
477	PROV0439	477
478	PROV0441	478
479	PROV0443	479
480	PROV0444	480
481	PROV0445	481
482	PROV0446	482
483	PROV0447	483
484	PROV0448	484
485	PROV0450	485
486	PROV0452	486
487	PROV0453	487
488	PROV0455	488
489	PROV0457	489
490	PROV0458	490
491	PROV0461	491
492	PROV0463	492
493	PROV0466	493
494	PROV0456	494
495	PROV0467	495
496	PROV0470	496
497	PROV0465	497
498	PROV0474	498
499	PROV0468	499
500	PROV0476	500
501	PROV0469	501
502	PROV0471	502
503	PROV0473	503
504	PROV0475	504
505	PROV0477	505
506	PROV0478	506
507	PROV0480	507
508	PROV0481	508
509	PROV0482	509
510	PROV0612	510
511	PROV0620	511
512	PROV1007	512
513	PROV1110	513
514	PROV1111	514
515	PROV1112	515
516	PROV1114	516
517	PROV1121	517
518	PROV1122	518
519	PROV1123	519
520	PROV1124	520
521	PROV1125	521
522	PROV1209	522
523	PROV0483	523
524	PROV0484	524
525	PROV1211	525
526	PROV1212	526
527	PROV1214	527
528	PROV1215	528
529	PROV1216	529
530	PROV1217	530
531	PROV1218	531
532	PROV1220	532
533	PROV1221	533
534	PROV1219	534
535	PROV1224	535
536	PROV1302	536
537	PROV1404	537
538	PROV1505	538
539	PROV1506	539
540	PROV1509	540
541	PROV1510	541
542	PROV1705	542
543	PROV0485	543
544	PROV1225	544
545	PROV0621	545
\.


--
-- Data for Name: ingreso; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ingreso (id_ingreso, fecha_recepcion, id_proveedor, id_licitacion, id_usuario_receptor) FROM stdin;
\.


--
-- Data for Name: institucion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.institucion (id_institucion, nombre, cue, id_edificio, establecimiento_cabecera, nivel_educativo, categoria, ambito, activo) FROM stdin;
1039	NOCTURNA JUAN E. SERU	700038000	1	VILLICUM	UEPA	TERCERA	PUBLICO	t
1040	VILLICUM	700038100	1	VILLICUM	PRIMARIO	PRIMERA	PUBLICO	t
1041	ANEXO ESC. TEC. CAP. LAB. SOFIA L. KLAPPENBACH	700070901	1	VILLICUM	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1042	ESCUELA TEC. CAP. LAB. ING. LUIS NOUSSAN	700078000	1	VILLICUM	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1043	E.N.I. Nº 17 XELU	700085100	1	VILLICUM	INICIAL	PRIMERA	PUBLICO	t
1044	C.E.N.S. ING. LUIS A. NOUSSAN	700097700	1	VILLICUM	CENS	TERCERA	PUBLICO	t
1045	C.E.N.S. 249  CESAR HERMOGENES GUERRERO	700005600	2	JUAN MANTOVANI	CENS	TERCERA	PUBLICO	t
1046	JUAN MANTOVANI	700037800	2	JUAN MANTOVANI	PRIMARIO	PRIMERA	PUBLICO	t
1047	E.N.I. Nº 19 TANITANI	700085200	2	JUAN MANTOVANI	INICIAL	PRIMERA	PUBLICO	t
1048	VICECOMODORO GUSTAVO MARAMBIO	700037600	3	VICECOMODORO GUSTAVO MARAMBIO	PRIMARIO	PRIMERA	PUBLICO	t
1049	PROPAA ZONA NORTE UNIDAD EDUCATIVA N° 52	700066221	3	VICECOMODORO GUSTAVO MARAMBIO	\N	\N	\N	t
1050	J.I.N.Z. Nº 33 VICECOMODORO GUSTAVO MARAMBIO  ANEXO	700097302	3	VICECOMODORO GUSTAVO MARAMBIO	INICIAL	SEGUNDA	PUBLICO	t
1051	ESCUELA SECUNDARIA VICE COMODORO GUSTAVO MARAMBIO	700110200	3	VICECOMODORO GUSTAVO MARAMBIO	SECUNDARIO	TERCERA	PUBLICO	t
1052	JOSE MARIA PAZ	700037700	4	JOSE MARIA PAZ	PRIMARIO	TERCERA	PUBLICO	t
1053	J.I.N.Z. Nº 34 JOSE MARIA PAZ SEDE	700097400	4	JOSE MARIA PAZ	INICIAL	PRIMERA	PUBLICO	t
1054	VICENTE LOPEZ Y PLANES	700032900	5	VICENTE LOPEZ Y PLANES	PRIMARIO	PRIMERA	PUBLICO	t
1055	E.N.I. Nº 21 HUEPIL	700085500	5	VICENTE LOPEZ Y PLANES	INICIAL	PRIMERA	PUBLICO	t
1056	EJERCITO DE LOS ANDES	700038200	6	EJERCITO DE LOS ANDES	PRIMARIO	TERCERA	PUBLICO	t
1057	J.I.N.Z. Nº 34 EJERCITO DE LOS ANDES  ANEXO	700097402	6	EJERCITO DE LOS ANDES	INICIAL	PRIMERA	PUBLICO	t
1058	ADAN QUIROGA	700005700	7	ADAN QUIROGA	PRIMARIO	TERCERA	PUBLICO	t
1059	J.I.N.Z. Nº 34 ADAN QUIROGA  ANEXO	700097404	7	ADAN QUIROGA	INICIAL	PRIMERA	PUBLICO	t
1060	ESCUELA SECUNDARIA ADAN QUIROGA	700107400	7	ADAN QUIROGA	SECUNDARIO	TERCERA	PUBLICO	t
1061	BENITA DAVILA DE DE LOS RIOS	700005800	8	BENITA DAVILA DE LOS RIOS	PRIMARIO	TERCERA	PUBLICO	t
1062	J.I.N.Z. Nº 33 BENITA DAVILA DE LOS RIOS  ANEXO	700097301	8	BENITA DAVILA DE LOS RIOS	INICIAL	SEGUNDA	PUBLICO	t
1063	JUAN GREGORIO DE LAS HERAS	700038300	9	JUAN GREGORIO DE LAS HERAS	PRIMARIO	TERCERA	PUBLICO	t
1064	J.I.N.Z. Nº 34 JUAN GREGORIO DE LAS HERAS  ANEXO	700097401	9	JUAN GREGORIO DE LAS HERAS	INICIAL	PRIMERA	PUBLICO	t
1065	ESCUELA E.E.E. HEBE NORA ARCE DE VIDELA DE ORO	700038400	10	E.E.E. HEBE NORA ARCE DE VIDELA DE ORO	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
1066	CAMILO ROJO	700033000	11	CAMILO ROJO	PRIMARIO	PRIMERA	PUBLICO	t
1067	E.N.I. Nº 15 TULUM	700083800	11	CAMILO ROJO	INICIAL	PRIMERA	PUBLICO	t
1068	E.P.E.T. N° 1 ALBARDON	700033100	12	E.P.E.T. N° 1 ALBARDON	TECNICO	PRIMERA	PUBLICO	t
1069	PROVINCIA DE JUJUY	700038500	13	PROVINCIA DE JUJUY	PRIMARIO	TERCERA	PUBLICO	t
1070	J.I.N.Z. Nº 33 PROVINCIA DE JUJUY  SEDE	700097300	13	PROVINCIA DE JUJUY	INICIAL	PRIMERA	PUBLICO	t
1071	ISLA VICECOMODORO MARAMBIO - EMER	700014900	14	ISLA VICECOMODORO MARAMBIO  EMER	PRIMARIO	TERCERA	PUBLICO	t
1072	ISLA VICECOMODORO MARAMBIO - EMER	700014900	14	ISLA VICECOMODORO MARAMBIO  EMER	SECUNDARIO	TERCERA	PUBLICO	t
1073	J.I.N.Z. Nº 13 ESC ISLA VICECOMODORO MARAMBIO ANEXO	700102704	14	ISLA VICECOMODORO MARAMBIO  EMER	INICIAL	SEGUNDA	PUBLICO	t
1074	JUAN PASCUAL PRINGLES - EMER	700049000	15	JUAN PASCUAL PRINGLES  EMER	PRIMARIO	TERCERA	PUBLICO	t
1075	JUAN PASCUAL PRINGLES - EMER	700049000	15	JUAN PASCUAL PRINGLES  EMER	SECUNDARIO	TERCERA	PUBLICO	t
1076	J.I.N.Z. Nº 13 ESC JUAN PASCUAL PRINGLES ANEXO	700102702	15	JUAN PASCUAL PRINGLES  EMER	INICIAL	SEGUNDA	PUBLICO	t
1077	CAPITAN JUAN EUGENIO DE MALLEA - EMER	700049600	16	CAPITAN JUAN EUGENIO DE MALLEA EMER	PRIMARIO	TERCERA	PUBLICO	t
1078	J.I.N.Z. Nº 13 ESC CAPITAN JUAN EUGENIO DE MALLEA SEDE	700102700	16	CAPITAN JUAN EUGENIO DE MALLEA EMER	INICIAL	PRIMERA	PUBLICO	t
1079	ESCUELA SECUNDARIA CAPITAN JUAN EUGENIO DE MALLEA	700112200	16	CAPITAN JUAN EUGENIO DE MALLEA EMER	SECUNDARIO	TERCERA	PUBLICO	t
1080	CIRILO SARMIENTO	700049500	17	CIRILO SARMIENTO	PRIMARIO	TERCERA	PUBLICO	t
1081	ANEXO ESC. TEC. CAP. LAB. JUAN JOSE PASO	700068201	17	CIRILO SARMIENTO	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1082	ESCUELA SECUNDARIA CIRILO SARMIENTO	700101500	17	CIRILO SARMIENTO	SECUNDARIO	TERCERA	PUBLICO	t
1083	J.I.N.Z. Nº 13  ESC CIRILO SARMIENTO ANEXO	700102703	17	CIRILO SARMIENTO	INICIAL	SEGUNDA	PUBLICO	t
1084	JUAN JOSE PASO	700014800	18	JUAN JOSE PASO	PRIMARIO	SEGUNDA	PUBLICO	t
1085	ESCUELA TEC. CAP. LAB. JUAN JOSE PASO	700068200	18	JUAN JOSE PASO	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1086	ESCUELA SECUNDARIA JUAN JOSE PASO	700100400	18	JUAN JOSE PASO	SECUNDARIO	TERCERA	PUBLICO	t
1087	J.I.N.Z. Nº 14 ESC JUAN JOSE PASO ANEXO	700103801	18	JUAN JOSE PASO	INICIAL	SEGUNDA	PUBLICO	t
1088	JUAN HUARPE - EMER	700048900	19	JUAN HUARPE  EMER	PRIMARIO	TERCERA	PUBLICO	t
1089	J.I.N.Z. Nº 14 ESC JUAN HUARPE ANEXO	700103804	19	JUAN HUARPE EMER	INICIAL	SEGUNDA	PUBLICO	t
1090	DR. BERNARDO HOUSSAY	700014600	20	DR. BERNARDO HOUSSAY	PRIMARIO	TERCERA	PUBLICO	t
1091	J.I.N.Z. Nº 14 ESC DR. BERNARDO HOUSSAY SEDE	700103800	20	DR. BERNARDO HOUSSAY	INICIAL	PRIMERA	PUBLICO	t
1092	JUAN JUFRE	700049200	21	JUAN JUFRE	PRIMARIO	PRIMERA	PUBLICO	t
1093	ESCUELA NOCTURNA “ANGEL ROGELIO GONZALEZ	700049300	21	JUAN JUFRE	UEPA	TERCERA	PUBLICO	t
1094	ESCUELA TEC. CAP. LAB. JUAN DE GARAY	700071500	21	JUAN JUFRE	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1095	C.E.N.S. JUAN DE GARAY	700097600	21	JUAN JUFRE	CENS	TERCERA	PUBLICO	t
1096	AULA SATELITE ESCUELA NOCTURNA PASO DE LOS PATOS - UEPA N° 7	700022701	22	LA CAPILLA	UEPA	TERCERA	PUBLICO	t
1097	C.E.N.S. CALINGASTA	700031600	22	LA CAPILLA	CENS	TERCERA	PUBLICO	t
1098	LA CAPILLA	700032000	22	LA CAPILLA	PRIMARIO	PRIMERA	PUBLICO	t
1099	UNIDAD EDUCATIVA N° 22  (EX - ETCL JOSE H. GONZALEZ)	700067700	22	LA CAPILLA	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1100	J.I.N.Z. Nº 2 ESC LA CAPILLA SEDE	700094200	22	LA CAPILLA	INICIAL	PRIMERA	PUBLICO	t
1101	LUIS PASTEUR	700031700	23	LUIS PASTEUR	PRIMARIO	TERCERA	PUBLICO	t
1102	J.I.N.Z. Nº 25 SEDE ESC LUIS PASTEUR	700105500	23	LUIS PASTEUR	INICIAL	TERCERA	PUBLICO	t
1103	JORGE NEWBERY	700031900	24	JORGE NEWBERY	PRIMARIO	TERCERA	PUBLICO	t
1104	J.I.N.Z. Nº 2 ESC JORGE NEWBERY ANEXO	700094201	24	JORGE NEWBERY	INICIAL	PRIMERA	PUBLICO	t
1105	SATURNINO ARAOZ	700022500	25	SATURNINO S. ARAOZ	PRIMARIO	SEGUNDA	PUBLICO	t
1106	ESCUELA NOCTURNA PASO DE LOS PATOS (UEPA Nº 7 )	700022700	25	SATURNINO S. ARAOZ	UEPA	TERCERA	PUBLICO	t
1107	E.N.I. Nº 74	700116800	25	SATURNINO S. ARAOZ	INICIAL	TERCERA	PUBLICO	t
1108	JOSE CLEMENTE SARMIENTO	700022200	26	JOSE CLEMENTE SARMIENTO	PRIMARIO	TERCERA	PUBLICO	t
1109	JUAN PEDRO ESNAOLA	700022400	27	JUAN PEDRO ESNAOLA	PRIMARIO	PRIMERA	PUBLICO	t
1110	J.I.N.Z. Nº 2 ESC JUAN PEDRO ESNAOLA ANEXO	700094202	27	JUAN PEDRO ESNAOLA	INICIAL	PRIMERA	PUBLICO	t
1111	MARTIN GIL	700022600	28	MARTIN GIL	PRIMARIO	TERCERA	PUBLICO	t
1112	J.I.N.Z. Nº 24 ESC MARTIN GIL SEDE	700105600	28	MARTIN GIL	INICIAL	TERCERA	PUBLICO	t
1113	12 DE OCTUBRE	700011500	29	12 DE OCTUBRE	PRIMARIO	TERCERA	PUBLICO	t
1114	J.I.N.Z. Nº 25  ESC 12 DE OCTUBRE ANEXO	700105501	29	12 DE OCTUBRE	INICIAL	TERCERA	PUBLICO	t
1115	J.I.N.Z. Nº 24 ESC BATALLA DE CHACABUCO ANEXO	700105604	30	BATALLA DE CHACABUCO	INICIAL	TERCERA	PUBLICO	t
1116	BATALLA DE CHACABUCO	700011400	30	BATALLA DE CHACABUCO	PRIMARIO	TERCERA	PUBLICO	t
1117	CLOTILDE GUILLEN DE REZZANO	700031800	31	CLOTILDE GUILLEN DE REZZANO	PRIMARIO	TERCERA	PUBLICO	t
1118	J.I.N.Z. Nº 25  ESC CLOTILDE GUILLEN DE REZZANOANEXO	700105502	31	CLOTILDE GUILLEN DE REZZANO	INICIAL	TERCERA	PUBLICO	t
1119	BENITO JUAREZ	700044700	32	BENITO JUAREZ	PRIMARIO	TERCERA	PUBLICO	t
1120	J.I.N.Z. Nº 25  ESC BENITO JUAREZ ANEXO	700105504	32	BENITO JUAREZ	INICIAL	TERCERA	PUBLICO	t
1121	FRANCISCO JAVIER MUNIZ	700011300	33	FRANCISCO JAVIER MUNIZ	PRIMARIO	TERCERA	PUBLICO	t
1122	J.I.N.Z. Nº 24 ESC FRANCISCO JAVIER MUNIZ ANEXO	700105601	33	FRANCISCO JAVIER MUNIZ	INICIAL	TERCERA	PUBLICO	t
1123	REMEDIOS ESCALADA DE SAN MARTIN	700010900	34	REMEDIOS ESCALADA DE SAN MARTIN	PRIMARIO	TERCERA	PUBLICO	t
1124	ESCUELA NOCTURNA PASO DE LOS PATOS AULA SATELITE	700022702	34	REMEDIOS ESCALADA DE SAN MARTIN	UEPA	TERCERA	PUBLICO	t
1125	COLEGIO SECUNDARIO DE TAMBERIAS	700044900	34	REMEDIOS ESCALADA DE SAN MARTIN	SECUNDARIO	TERCERA	PUBLICO	t
1126	J.I.N.Z. Nº 24 ESC REMEDIOS ESCALADA DE SAN MARTIN ANEXO	700105602	34	REMEDIOS ESCALADA DE SAN MARTIN	INICIAL	TERCERA	PUBLICO	t
1127	C.E.N.S. TAMBERIAS	700107900	34	REMEDIOS ESCALADA DE SAN MARTIN	CENS	TERCERA	PUBLICO	t
1128	BATALLA DE MAIPU	700011100	35	BATALLA DE MAIPU	PRIMARIO	TERCERA	PUBLICO	t
1129	ESCUELA TEC. CAP. LAB. REMEDIOS ESCALADA DE SAN MARTIN	700068900	35	BATALLA DE MAIPU	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1130	J.I.N.Z. Nº 24  ESC BATALLA DE MAIPU ANEXO	700105603	35	BATALLA DE MAIPU	INICIAL	TERCERA	PUBLICO	t
1131	SATURNINO MARIA DE LASPIUR	700010800	36	SATURNINO MARIA DE LASPIUR	PRIMARIO	TERCERA	PUBLICO	t
1132	J.I.N.Z. Nº 25  ESC SATURNINO MARIA DE LASPIUR ANEXO	700105503	36	SATURNINO MARIA DE LASPIUR	INICIAL	TERCERA	PUBLICO	t
1133	TTE. CORONEL ALVAREZ CONDARCO	700044800	37	ALBERGUE TTE. CORONEL ALVAREZ CONDARCO	ALBERGUE	TERCERA	PUBLICO	t
1134	J.I.N.Z. Nº 25  ESC ALBERGUE TENIENTE CORONEL ALVAREZ CONDARCO ANEXO	700105505	37	ALBERGUE TENIENTE CORONEL ALVAREZ CONDARCO	INICIAL	TERCERA	PUBLICO	t
1135	J.I.N.Z. CAPITAL - PROVINCIA DE BUENOS AIRES ANEXO	700002401	38	PROVINCIA DE BUENOS AIRES	INICIAL	PRIMERA	PUBLICO	t
1136	C.E.N.T. N° 18	700030500	38	PROVINCIA DE BUENOS AIRES	SUPERIOR	PRIMERA	PUBLICO	t
1137	PROVINCIA DE BUENOS AIRES	700060900	38	PROVINCIA DE BUENOS AIRES	PRIMARIO	PRIMERA	PUBLICO	t
1138	PROPAA ZONA OESTE SEDE PROV BS AS	700066400	38	PROVINCIA DE BUENOS AIRES	PROPAA	CUARTA	PUBLICO	t
1139	J.I.N.Z. CAPITAL - PROVINCIA DE SANTIAGO DEL ESTERO ANEXO	700002403	39	PROVINCIA DE SANTIAGO DEL ESTERO	INICIAL	PRIMERA	PUBLICO	t
1140	ESCUELA SECUNDARIA DE COMERCIO GRAL. MANUEL BELGRANO	700030800	39	PROVINCIA DE SANTIAGO DEL ESTERO	SECUNDARIO	PRIMERA	PUBLICO	t
1141	PROVINCIA DE SANTIAGO DEL ESTERO	700030900	39	PROVINCIA DE SANTIAGO DEL ESTERO	PRIMARIO	PRIMERA	PUBLICO	t
1142	COLEGIO NACIONAL MONS. DR. PABLO CABRERA	700061700	40	COLEGIO NACIONAL MONS. DR. PABLO CABRERA	SECUNDARIO	PRIMERA	PUBLICO	t
1143	LICEO PAULA ALBARRACIN DE SARMIENTO	700062200	40	COLEGIO NACIONAL MONS. DR. PABLO CABRERA	SECUNDARIO	PRIMERA	PUBLICO	t
1144	ESCUELA COMERCIO NOCTURNA DR. SANTIAGO CORTINEZ	700062700	40	COLEGIO NACIONAL MONS. DR. PABLO CABRERA	SECUNDARIO	PRIMERA	PUBLICO	t
1145	C.E.N.S. N° 74 JUAN VUCETICH	700024200	41	FRAY JUSTO SANTA MARIA DE ORO	CENS	TERCERA	PUBLICO	t
1146	COLEGIO PROVINCIAL CONCEPCION	700059800	41	FRAY JUSTO SANTA MARIA DE ORO	SECUNDARIO	PRIMERA	PUBLICO	t
1147	FRAY JUSTO SANTA MARIA DE ORO	700060000	41	FRAY JUSTO SANTA MARIA DE ORO	PRIMARIO	PRIMERA	PUBLICO	t
1148	E.N.I. Nº 77	700115200	41	FRAY JUSTO SANTA MARIA DE ORO	INICIAL	TERCERA	PUBLICO	t
1149	PROVINCIA DE SANTA FE	700054900	42	PROVINCIA DE SANTA FE	PRIMARIO	SEGUNDA	PUBLICO	t
1150	COLEGIO PROVINCIAL DE CAPITAL	700055500	42	PROVINCIA DE SANTA FE	SECUNDARIO	PRIMERA	PUBLICO	t
1151	DR. JUAN CRISOSTOMO ALBARRACIN	700058400	42	PROVINCIA DE SANTA FE	PRIMARIO	TERCERA	PUBLICO	t
1152	E.N.I. Nº 35 ESTRELLA DE LOS ANDES	700087000	42	PROVINCIA DE SANTA FE	INICIAL	PRIMERA	PUBLICO	t
1153	NOCTURNA SARMIENTO	700012800	43	SARMIENTO	UEPA	TERCERA	PUBLICO	t
1154	PAULA ALBARRACIN DE SARMIENTO	700047700	43	SARMIENTO	PRIMARIO	PRIMERA	PUBLICO	t
1155	ESCUELA DE BIBLIOTECOLOGIA DR. MARIANO MORENO	700047800	43	SARMIENTO	SUPERIOR	PRIMERA	PUBLICO	t
1156	SARMIENTO	700048000	43	SARMIENTO	PRIMARIO	PRIMERA	PUBLICO	t
1157	ESCUELA TEC. CAP. LAB. SABINO PIGNATARI	700067400	43	SARMIENTO	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1158	ESCUELA NORMAL SUPERIOR GRAL. SAN MARTIN	700060500	44	ESC. NORMAL SUPERIOR GRAL. SAN MARTIN	INICIAL	PRIMERA	PUBLICO	t
1159	ESCUELA NORMAL SUPERIOR GRAL. SAN MARTIN	700060500	44	ESC. NORMAL SUPERIOR GRAL. SAN MARTIN	PRIMARIO	PRIMERA	PUBLICO	t
1160	ESCUELA NORMAL SUPERIOR GRAL. SAN MARTIN	700060500	44	ESC. NORMAL SUPERIOR GRAL. SAN MARTIN	SECUNDARIO	PRIMERA	PUBLICO	t
1161	ESCUELA NORMAL SUPERIOR GRAL. SAN MARTIN	700060500	44	ESC. NORMAL SUPERIOR GRAL. SAN MARTIN	SUPERIOR	PRIMERA	PUBLICO	t
1162	C.E.N.S. Nº 69 PROFESORA MARIA DEL CARMEN CABALLERO VIDAL	700012900	45	ESC. NORMAL SUPERIOR SARMIENTO	CENS	TERCERA	PUBLICO	t
1163	ESCUELA SUPERIOR NORMAL SUPERIOR SARMIENTO	700025400	45	ESC. NORMAL SUPERIOR SARMIENTO	INICIAL	PRIMERA	PUBLICO	t
1164	ESCUELA SUPERIOR NORMAL SUPERIOR SARMIENTO	700025400	45	ESC. NORMAL SUPERIOR SARMIENTO	PRIMARIO	PRIMERA	PUBLICO	t
1165	ESCUELA SUPERIOR NORMAL SUPERIOR SARMIENTO	700025400	45	ESC. NORMAL SUPERIOR SARMIENTO	SECUNDARIO	PRIMERA	PUBLICO	t
1166	ESCUELA SUPERIOR NORMAL SUPERIOR SARMIENTO	700025400	45	ESC. NORMAL SUPERIOR SARMIENTO	SUPERIOR	PRIMERA	PUBLICO	t
1167	NOCTURNA JUAN B. ALBERDI ANEXO	700024401	46	BERNARDINO RIVADAVIA	UEPA	TERCERA	PUBLICO	t
1168	FRANCISCO NARCISO DE LAPRIDA	700042400	46	BERNARDINO RIVADAVIA	PRIMARIO	PRIMERA	PUBLICO	t
1169	BERNARDINO RIVADAVIA	700044000	46	BERNARDINO RIVADAVIA	PRIMARIO	PRIMERA	PUBLICO	t
1170	ESCUELA TEC. CAP. LAB. DOMINGO CAYETANO VALLVE	700079300	46	BERNARDINO RIVADAVIA	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1171	ESCUELA SECUNDARIA DR. FRANCISCO NARCISO LAPRIDA	700089200	46	BERNARDINO RIVADAVIA	SECUNDARIO	TERCERA	PUBLICO	t
1172	C.E.N.S 348 MADRE TERESA DE CALCUTA	700000900	47	E.P.E.T. N° 4	CENS	TERCERA	PUBLICO	t
1173	E.P.E.T. N° 4	700026400	47	E.P.E.T. N° 4	TECNICO	PRIMERA	PUBLICO	t
1174	NOCTURNA ANTONIO TORRES	700009600	48	ANTONIO TORRES	UEPA	TERCERA	PUBLICO	t
1175	ANTONIO TORRES TURNO TARDE	700041800	48	ANTONIO TORRES	PRIMARIO	PRIMERA	PUBLICO	t
1176	ANTONIO TORRES TURNO MANANA	700042000	48	ANTONIO TORRES	PRIMARIO	PRIMERA	PUBLICO	t
1177	C.E.N.S. N° 210	700062100	48	ANTONIO TORRES	CENS	SEGUNDA	PUBLICO	t
1178	INSTITUTO DE FORMACION DOCENTE ESCUELA DE LA FAMILIA	700077200	48	ANTONIO TORRES	SUPERIOR	PRIMERA	PUBLICO	t
1179	25 DE MAYO	700047500	49	25 DE MAYO	PRIMARIO	PRIMERA	PUBLICO	t
1180	PROPAA ZONA OESTE UNIDAD EDUCATIVA N° 39	700066409	49	25 DE MAYO	PROPAA	CUARTA	PUBLICO	t
1181	ESCUELA TEC. CAP. LAB. JUAN BAUTISTA ALBERDI	700070400	49	25 DE MAYO	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1182	ESCUELA DE SECUNDARIA 9 DE JULIO	700084400	49	25 DE MAYO	SECUNDARIO	PRIMERA	PUBLICO	t
1183	E.N.I. Nº 63 LIHUE	700100000	49	25 DE MAYO	INICIAL	SEGUNDA	PUBLICO	t
1184	E.P.E.T. N° 1 ING. ROGELIO BOERO	700027600	50	E.P.E.T. N° 1 SAN JUAN ING. ROGELIO BOERO	TECNICO	PRIMERA	PUBLICO	t
1185	E.P.E.T. N° 2	700026700	51	E.P.E.T. N° 2	TECNICO	PRIMERA	PUBLICO	t
1186	E.P.E.T. N° 5	700061600	52	E.P.E.T. N° 5 SAN JUAN	TECNICO	PRIMERA	PUBLICO	t
1187	MANUEL BELGRANO	700002500	53	MANUEL BELGRANO	PRIMARIO	PRIMERA	PUBLICO	t
1188	CENTRO EDUCATIVO DE EDUCACIoN DOMICILIARIA Y HOSPITALARIA	700060300	54	E.E.E. DR. GUILLERMO RAWSON	EDUCACION HOSPITALARIA	PRIMERA	PUBLICO	t
1189	ESCUELA E.E.E. JOSE A. TERRY	700045800	55	E.E.E. JOSE A. TERRY	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
1190	PROPAA ZONA SUR UNIDAD EDUCATIVA N° 73	700066121	55	E.E.E. JOSE A. TERRY	PROPAA	TERCERA	PUBLICO	t
1191	ESCUELA E.E.E. MERCEDITAS DE SAN MARTIN	700026500	56	E.E.E. MERCEDITAS DE SAN MARTIN	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
1192	PROPAA ZONA NORTE UNIDAD EDUCATIVA N° 83	700066205	56	E.E.E. MERCEDITAS DE SAN MARTIN	\N	\N	\N	t
1193	PINKANTA	700010600	57	PINKANTA (EX E.N.I. N° 2)	INICIAL	PRIMERA	PUBLICO	t
1194	CORONEL LUIS JORGE FONTANA	700002300	58	CORONEL LUIS JORGE FONTANA	PRIMARIO	PRIMERA	PUBLICO	t
1195	J.I.N.Z. CAPITAL - CORONEL LUIS JORGE FONTANA SEDE	700002400	58	CORONEL LUIS JORGE FONTANA	INICIAL	PRIMERA	PUBLICO	t
1196	INSTITUTO SUPERIOR TECNICO PROFESIONAL DE ENOLOGIA E INDU. FRUTIH.	700064700	58	LUIS JORGE FONTANA	SUPERIOR	SEGUNDA	PUBLICO	t
1197	ANEXO NOCTURNA PEDRO ECHAGUE	700017701	211	B° PARQUE RIVADAVIA NORTE	UEPA	TERCERA	PUBLICO	t
1198	CAMPANA DEL DESIERTO	700027800	59	CAMPANA DEL DESIERTO	PRIMARIO	PRIMERA	PUBLICO	t
1199	J.I.N.Z. Nº 42 CAMPANA DEL DESIERTO ANEXO	700098303	59	CAMPANA DEL DESIERTO	INICIAL	PRIMERA	PUBLICO	t
1200	ESCUELA SECUNDARIA CAMPANA DEL DESIERTO	700101400	59	CAMPANA DEL DESIERTO	SECUNDARIO	TERCERA	PUBLICO	t
1201	NOCTURNA MATIAS ZAVALLA	700027200	60	PRESIDENTE HIPOLITO YRIGOYEN	UEPA	TERCERA	PUBLICO	t
1202	PRESIDENTE HIPOLITO YRIGOYEN	700027400	60	PRESIDENTE HIPOLITO YRIGOYEN	PRIMARIO	SEGUNDA	PUBLICO	t
1203	FAUSTINA SARMIENTO DE BELIN	700027500	60	PRESIDENTE HIPOLITO YRIGOYEN	PRIMARIO	TERCERA	PUBLICO	t
1204	ESCUELA TEC. CAP. LAB. ING. ESTANISLAO TELLO	700071900	60	PRESIDENTE HIPOLITO YRIGOYEN	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1205	J.I.N.Z. Nº 42  PRESIDENTE HIPOLITO IRIGOYEN ANEXO	700098301	60	PRESIDENTE HIPOLITO YRIGOYEN	INICIAL	PRIMERA	PUBLICO	t
1206	J.I.N.Z. Nº 42  FAUSTINA SARMIENTO DE BELIN ANEXO	700098302	60	PRESIDENTE HIPOLITO YRIGOYEN	INICIAL	PRIMERA	PUBLICO	t
1207	ESCUELA SECUNDARIA FAUSTINA SARMIENTO DE BELIN	700106700	60	PRESIDENTE HIPOLITO YRIGOYEN	SECUNDARIO	TERCERA	PUBLICO	t
1208	ESCUELA SECUNDARIA PRESIDENTE HIPOLITO YRIGOYEN	700115700	60	PRESIDENTE HIPOLITO YRIGOYEN	SECUNDARIO	TERCERA	PUBLICO	t
1209	TENIENTE 1° FRANCISCO IBANEZ	700061500	61	TTE. 1° FRANCISCO IBANEZ	PRIMARIO	PRIMERA	PUBLICO	t
1210	J.I.N.Z. Nº 41 TTE 1º FRANCISCO IBANEZ ANEXO	700098404	61	TTE. 1° FRANCISCO IBANEZ	INICIAL	PRIMERA	PUBLICO	t
1211	ESCUELA SECUNDARIA TENIENTE 1º FRANCISCO IBANEZ	700105400	61	TTE. 1° FRANCISCO IBANEZ	SECUNDARIO	TERCERA	PUBLICO	t
1212	COMANDANTE CABOT	700031100	62	COMANDANTE CABOT	PRIMARIO	TERCERA	PUBLICO	t
1213	ANEXO ESC. TEC. CAP. LAB. RICARDO ROJAS	700069101	62	COMANDANTE CABOT	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1214	J.I.N.Z. Nº 41  COMANDANTE CABOT ANEXO	700098402	62	COMANDANTE CABOT	INICIAL	PRIMERA	PUBLICO	t
1215	ESCUELA SECUNDARIA COMANDANTE CABOT	700111800	62	COMANDANTE CABOT	SECUNDARIO	TERCERA	PUBLICO	t
1216	CLARA ROSA CORTINEZ	700003000	63	CLARA ROSA CORTINEZ	PRIMARIO	PRIMERA	PUBLICO	t
1217	E.N.I. Nº 31 PATRICIAS SANJUANINAS	700087800	63	CLARA ROSA CORTINEZ	INICIAL	PRIMERA	PUBLICO	t
1218	E.N.I. Nº  1 FEDERICO FROEBEL	700002600	64	ESTEBAN ECHEVERRIA	INICIAL	PRIMERA	PUBLICO	t
1219	C.E.N.S. N° 188	700031200	64	ESTEBAN ECHEVERRIA	CENS	TERCERA	PUBLICO	t
1220	ESTEBAN ECHEVERRIA	700031300	64	ESTEBAN ECHEVERRIA	PRIMARIO	TERCERA	PUBLICO	t
1221	PROPAA ZONA OESTE UNIDAD EDUCATIVA N° 57	700066416	64	ESTEBAN ECHEVERRIA	\N	\N	\N	t
1344	PROPAA ZONA NORTE UNIDAD EDUCATIVA N° 73	700066217	106	WERFIELD SALINAS	PROPAA	TERCERA	PUBLICO	t
1222	ESCUELA TEC. CAP. LAB. NICOMEDES SEGUNDO PINTO	700069900	64	ESTEBAN ECHEVERRIA	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1223	ESCUELA SECUNDARIA ESTEBAN ECHEVERRIA	700093400	64	ESTEBAN ECHEVERRIA	SECUNDARIO	TERCERA	PUBLICO	t
1224	NOCTURNA FRAY JUSTO SANTA MARIA DE ORO	700059700	65	DR. GUILLERMO RAWSON	UEPA	TERCERA	PUBLICO	t
1225	DR. JOSE IGNACIO DE LA ROZA	700059900	65	DR. GUILLERMO RAWSON	PRIMARIO	SEGUNDA	PUBLICO	t
1226	DR. GUILLERMO RAWSON	700060100	65	DR. GUILLERMO RAWSON	PRIMARIO	PRIMERA	PUBLICO	t
1227	ESCUELA TEC. CAP. LAB. RICARDO ROJAS	700069100	65	DR. GUILLERMO RAWSON	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1228	E.N.I. Nº 53 LOS COLIBRIES	700095500	65	DR. GUILLERMO RAWSON	INICIAL	PRIMERA	PUBLICO	t
1229	9 DE JULIO	700061200	66	FLORENTINO AMEGHINO	PRIMARIO	TERCERA	PUBLICO	t
1230	DR. FLORENTINO AMEGHINO	700061400	66	FLORENTINO AMEGHINO	PRIMARIO	SEGUNDA	PUBLICO	t
1231	E.N.I. Nº 78	700115400	66	FLORENTINO AMEGHINO	INICIAL	PRIMERA	PUBLICO	t
1232	J.I.N.Z. CAPITAL - TENIENTE PEDRO NOLASCO FONSECA ANEXO	700002404	67	TENIENTE PEDRO NOLASCO FONSECA	INICIAL	PRIMERA	PUBLICO	t
1233	TENIENTE PEDRO NOLASCO FONSECA	700058000	67	TENIENTE PEDRO NOLASCO FONSECA	PRIMARIO	PRIMERA	PUBLICO	t
1234	ESCUELA DE FRUTICULTURA Y ENOLOGIA	700027700	68	ESCUELA DE FRUTICULTURA Y ENOLOGIA	AGROTECNICA	PRIMERA	PUBLICO	t
1235	MARIA LUISA VILLARINO DE DEL CARRIL	700027100	69	MARIA L. VILLARINO DEL CARRIL	PRIMARIO	PRIMERA	PUBLICO	t
1236	ESCUELA TEC. CAP. LAB. ARNOBIO SANCHEZ	700069300	69	MARIA L. VILLARINO DEL CARRIL	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1237	J.I.N.Z. Nº 42 MARIA LUISA VILLARINO DE DEL CARRIL SEDE	700098300	69	MARIA L. VILLARINO DEL CARRIL	INICIAL	PRIMERA	PUBLICO	t
1238	MANUEL LAINEZ	700011900	70	MANUEL LAINEZ	PRIMARIO	PRIMERA	PUBLICO	t
1239	CENTRO POLIVALENTE DE ARTE	700046200	70	MANUEL LAINEZ	SECUNDARIO	PRIMERA	PUBLICO	t
1240	J.I.N.Z. Nº 41  MANUEL LAINEZ ANEXO	700098403	70	MANUEL LAINEZ	INICIAL	PRIMERA	PUBLICO	t
1241	NOCTURNA PROVINCIA DE CORDOBA	700033200	71	ANGEL DOMINGO ROJAS	UEPA	TERCERA	PUBLICO	t
1242	PERITO FRANCISCO PASCACIO MORENO	700058200	71	ANGEL DOMINGO ROJAS	PRIMARIO	SEGUNDA	PUBLICO	t
1243	ANGEL DOMINGO ROJAS	700058300	71	ANGEL DOMINGO ROJAS	PRIMARIO	PRIMERA	PUBLICO	t
1244	ESCUELA TEC. CAP. LAB. DR. CARLOS MARIA BIEDMA	700066500	71	ANGEL DOMINGO ROJAS	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1245	NOCTURNA TAMBOR DE TACUARI	700045400	72	MIGUEL DE AZCUENAGA	UEPA	TERCERA	PUBLICO	t
1246	MIGUEL DE AZCUENAGA	700045600	72	MIGUEL DE AZCUENAGA	PRIMARIO	TERCERA	PUBLICO	t
1247	ESCUELA SECUNDARIA MIGUEL DE AZCUENAGA	700091400	72	MIGUEL DE AZCUENAGA	SECUNDARIO	TERCERA	PUBLICO	t
1248	J.I.N.Z. Nº 41  MIGUEL DE AZCUENAGA SEDE	700098401	72	MIGUEL DE AZCUENAGA	INICIAL	PRIMERA	PUBLICO	t
1249	ESCUELA E.E.E. LUIS BRAILLE	700033400	73	E.E.E. LUIS BRAILE	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
1250	ESCUELA DE EDUCACION ESPECIAL ARA SAN JUAN (EX E.E.E. SARM)	700045900	74	ESCUELA DE EDUCACION ESPECIAL ARA SAN JUAN (EX E.E.E. SARM)	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
1251	C.E.N.S. N° 239	700060600	75	CAPITAL FEDERAL	CENS	TERCERA	PUBLICO	t
1252	CAPITAL FEDERAL	700060700	75	CAPITAL FEDERAL	PRIMARIO	PRIMERA	PUBLICO	t
1253	ANEXO ESC. TEC. CAP. LAB. JUAN BAUTISTA ALBERDI	700070401	75	CAPITAL FEDERAL	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1254	J.I.N.Z. Nº 41 CAPITAL FEDERAL ANEXO	700098400	75	CAPITAL FEDERAL	INICIAL	PRIMERA	PUBLICO	t
1255	DR. ISIDRO MARIANO DE ZAVALLA	700036600	76	JOSE CHIRAPOZU	PRIMARIO	PRIMERA	PUBLICO	t
1256	JOSE CHIRAPOZU	700036700	76	JOSE CHIRAPOZU	PRIMARIO	PRIMERA	PUBLICO	t
1257	E.N.I. Nº 24 SAN JUAN PABLO II	700085700	76	JOSE CHIRAPOZU	INICIAL	PRIMERA	PUBLICO	t
1258	ESCUELA NORMAL SUPERIOR GRAL. MANUEL BELGRANO	700039800	77	ESCUELA NORMAL SUPERIOR GRAL. MANUEL BELGRANO	INICIAL	PRIMERA	PUBLICO	t
1259	ESCUELA NORMAL SUPERIOR GRAL. MANUEL BELGRANO	700039800	77	ESCUELA NORMAL SUPERIOR GRAL. MANUEL BELGRANO	PRIMARIO	PRIMERA	PUBLICO	t
1260	ESCUELA NORMAL SUPERIOR GRAL. MANUEL BELGRANO	700039800	77	ESCUELA NORMAL SUPERIOR GRAL. MANUEL BELGRANO	SECUNDARIO	PRIMERA	PUBLICO	t
1261	ESCUELA NORMAL SUPERIOR GRAL. MANUEL BELGRANO	700039800	77	ESCUELA NORMAL SUPERIOR GRAL. MANUEL BELGRANO	SUPERIOR	PRIMERA	PUBLICO	t
1262	INSTITUTO SUPERIOR EN DESARROLLO DE SOFTWARE	700039801	77	ESCUELA NORMAL SUPERIOR GRAL. MANUEL BELGRANO	\N	\N	\N	t
1263	NOCTURNA JOSE MANUEL ESTRADA ANEXO 1 BERMEJO	700004401	78	E.E.E. MARIA MONTESSORI	\N	\N	\N	t
1264	ESCUELA E.E.E. MARIA MONTESSORI	700036300	78	E.E.E. MARIA MONTESSORI	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
1265	AGROTECNICA GONZALO ALBERTO DOBLAS	700055800	79	AGROTECNICA GONZALO ALBERTO DOBLAS	AGROTECNICA	TERCERA	PUBLICO	t
1266	INSTITUTO SUPERIOR DE ENOLOGIA E INDU. FRUTIH. ANEXO CAUCETE	700064701	79	AGROTECNICA GONZALO ALBERTO DOBLAS	SUPERIOR	CUARTA	PUBLICO	t
1267	REPUBLICA ARGENTINA	700021700	80	REPUBLICA ARGENTINA	PRIMARIO	SEGUNDA	PUBLICO	t
1268	EEE REPUBLICA ARGENTINA ANEXO BERMEJO	700021701	80	REPUBLICA ARGENTINA	EDUCACION ESPECIAL	CUARTA	PUBLICO	t
1269	ESCUELA SECUNDARIA REPUBLICA ARGENTINA	700102500	80	REPUBLICA ARGENTINA	SECUNDARIO	TERCERA	PUBLICO	t
1270	J.I.N.Z. Nº 54 ESC REPUBLICA ARGENTINA ANEXO	700111401	80	REPUBLICA ARGENTINA	INICIAL	SEGUNDA	PUBLICO	t
1271	E.P.E.T. N° 1 CAUCETE	700040300	81	E.P.E.T. N° 1 CAUCETE	TECNICO	PRIMERA	PUBLICO	t
1272	NOCTURNA DR. AMAN RAWSON	700040000	82	MANUEL PACIFICO ANTEQUEDA	UEPA	TERCERA	PUBLICO	t
1273	PRESBITERO MARIANO IANNELLI	700040100	82	MANUEL PACIFICO ANTEQUEDA	PRIMARIO	PRIMERA	PUBLICO	t
1274	MANUEL PACIFICO ANTEQUEDA T.M.	700040200	82	MANUEL PACIFICO ANTEQUEDA	PRIMARIO	PRIMERA	PUBLICO	t
1275	ESCUELA TEC. CAP. LAB. LUIS JOFRE	700069000	82	MANUEL PACIFICO ANTEQUEDA	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1276	E.N.I. Nº 56 HEROES DE MALVINAS	700096600	82	MANUEL PACIFICO ANTEQUEDA	INICIAL	PRIMERA	PUBLICO	t
1277	DR. SATURNINO SALAS	700018600	83	DR. SATURNINO SALAS	PRIMARIO	TERCERA	PUBLICO	t
1278	J.I.N.Z. Nº 32  DR. SATURNINO SALAS ANEXO	700103001	83	DR. SATURNINO SALAS	INICIAL	PRIMERA	PUBLICO	t
1279	ESCUELA SECUNDARIA DR. SATURNINO SALAS	700108400	83	DR. SATURNINO SALAS	SECUNDARIO	TERCERA	PUBLICO	t
1280	C.E.N.S. EL RINCON	700113200	83	DR. SATURNINO SALAS	CENS	TERCERA	PUBLICO	t
1281	REPUBLICA DE BOLIVIA	700021800	84	REPUBLICA DE BOLIVIA	PRIMARIO	TERCERA	PUBLICO	t
1282	J.I.N.Z. Nº 54  ESC REPUBLICA DEL PARAGUAY SEDE	700111403	84	REPUBLICA DE BOLIVIA	INICIAL	SEGUNDA	PUBLICO	t
1283	ESTANISLAO DEL CAMPO	700008900	85	ESTANISLAO DEL CAMPO	PRIMARIO	TERCERA	PUBLICO	t
1284	ESCUELA AMERICA SOFIA GIL DE CALVO (EX U.E.P.A. MOVIL N° 2)	700009100	85	ESTANISLAO DEL CAMPO	UEPA	TERCERA	PUBLICO	t
1285	J.I.N.Z. Nº 55  ESC ESTANISLAO DEL CAMPO ANEXO	700111203	85	ESTANISLAO DEL CAMPO	INICIAL	PRIMERA	PUBLICO	t
1286	JUAN LAVALLE	700009000	86	JUAN LAVALLE	PRIMARIO	TERCERA	PUBLICO	t
1287	J.I.N.Z. Nº 55  ESC JUAN LAVALLE ANEXO	700111202	86	JUAN LAVALLE	INICIAL	PRIMERA	PUBLICO	t
1288	ROMULO GIUFFRA	700056700	87	ROMULO GIUFFRA	PRIMARIO	TERCERA	PUBLICO	t
1289	J.I.N.Z. Nº 54  ESC ROMULO GIUFFRA ANEXO	700111404	87	ROMULO GIUFFRA	INICIAL	SEGUNDA	PUBLICO	t
1290	DRA. LETICIA ACOSTA DE SORMANI	700022000	88	DRA. LETICIA A. DE SORMANI	PRIMARIO	TERCERA	PUBLICO	t
1291	HIPOLITO VIEYTES	700039600	89	HIPOLITO VIEYTES	PRIMARIO	PRIMERA	PUBLICO	t
1292	ESCUELA SECUNDARIA HIPOLITO VIEYTES	700092900	89	HIPOLITO VIEYTES	SECUNDARIO	TERCERA	PUBLICO	t
1293	E.N.I. Nº 72 ANTONIO AGULLES	700107100	89	HIPOLITO VIEYTES	INICIAL	TERCERA	PUBLICO	t
1294	JOSE MARIA DE LOS RIOS	700009200	90	JOSE MARIA DE LOS RIOS	PRIMARIO	TERCERA	PUBLICO	t
1295	J.I.N.Z. Nº 55 ESC JOSE MARIA DE LOS RIOS SEDE	700111200	90	JOSE MARIA DE LOS RIOS	INICIAL	PRIMERA	PUBLICO	t
1296	ANDINA	700055600	91	ANDINA	PRIMARIO	SEGUNDA	PUBLICO	t
1297	J.I.N.Z. Nº 53 ESC ANDINA SEDE	700108300	91	ANDINA	INICIAL	PRIMERA	PUBLICO	t
1298	ESCUELA DE EDUCACION SECUNDARIA ANDINA	700115600	91	ANDINA	SECUNDARIO	TERCERA	PUBLICO	t
1299	PRESIDENTE JULIO ARGENTINO ROCA	700056800	92	PRESIDENTE ROCA	PRIMARIO	TERCERA	PUBLICO	t
1300	J.I.N.Z. Nº 54 ESC PRESIDENTE JULIO ARGENTINO ROCA ANEXO	700111405	92	PRESIDENTE ROCA	INICIAL	SEGUNDA	PUBLICO	t
1301	ARTURO BERUTI	700018700	93	ARTURO BERUTI	PRIMARIO	TERCERA	PUBLICO	t
1302	ESCUELA TEC. CAP. LAB. N° 1 PEDRO ECHAGUE	700068700	93	ARTURO BERUTI	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1303	J.I.N.Z. Nº 32  ESC ARTURO BERUTI ANEXO	700103002	93	ARTURO BERUTI	INICIAL	PRIMERA	PUBLICO	t
1304	ESCUELA SECUNDARIA ARTURO BERUTI	700113000	93	ARTURO BERUTI	SECUNDARIO	TERCERA	PUBLICO	t
1305	JUAN DE DIOS FLORES	700018800	94	JUAN DE DIOS FLORES	PRIMARIO	TERCERA	PUBLICO	t
1306	J.I.N.Z. Nº 53  ESC JUAN DE DIOS FLORES ANEXO	700108301	94	JUAN DE DIOS FLORES	INICIAL	PRIMERA	PUBLICO	t
1307	OBISPO ZAPATA	700019000	95	OBISPO ZAPATA	PRIMARIO	TERCERA	PUBLICO	t
1308	ESCUELA SECUNDARIA OBISPO ZAPATA	700091900	95	OBISPO ZAPATA	SECUNDARIO	TERCERA	PUBLICO	t
1309	J.I.N.Z. Nº 53  ESC OBISPO ZAPATA ANEXO	700108303	95	OBISPO ZAPATA	INICIAL	PRIMERA	PUBLICO	t
1310	REPUBLICA DEL PARAGUAY	700022100	96	REPUBLICA DEL PARAGUAY	PRIMARIO	TERCERA	PUBLICO	t
1311	NOCTURNA DR. AMAN RAWSON ANEXO 1 VALLECITO	700040001	96	REPUBLICA DEL PARAGUAY	UEPA	TERCERA	PUBLICO	t
1312	ESCUELA SECUNDARIA REPUBLICA DEL PARAGUAY	700101000	96	REPUBLICA DEL PARAGUAY	SECUNDARIO	TERCERA	PUBLICO	t
1313	J.I.N.Z. Nº 54 ESC REPUBLICA DE BOLIVIA ANEXO	700111400	96	REPUBLICA DEL PARAGUAY	INICIAL	PRIMERA	PUBLICO	t
1314	NOCTURNA JOSE MANUEL ESTRADA ANEXO 2 VILLA INDEPENDENCIA	700004402	97	PEDRO ECHAGUE	\N	\N	\N	t
1315	PEDRO ECHAGUE	700039700	97	PEDRO ECHAGUE	PRIMARIO	TERCERA	PUBLICO	t
1316	ESCUELA SECUNDARIA PEDRO ECHAGUE	700102400	97	PEDRO ECHAGUE	SECUNDARIO	TERCERA	PUBLICO	t
1317	J.I.N.Z. Nº 55  ESC PEDRO ECHAGUE ANEXO	700111201	97	PEDRO ECHAGUE	INICIAL	PRIMERA	PUBLICO	t
1318	ESCUELA E.E.E. JUANA GODOY DE BRANDES	700015600	98	C.E.N.S. SAN JUAN DE DIOS	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
1319	C.E.N.S. SAN JUAN DE DIOS	700016600	98	C.E.N.S. SAN JUAN DE DIOS	CENS	TERCERA	PUBLICO	t
1320	INGENIEROS DE SAN JUAN	700004200	99	INGENIEROS DE SAN JUAN	PRIMARIO	PRIMERA	PUBLICO	t
1321	SALVADOR MARIA DEL CARRIL	700058800	100	SALVADOR MARIA DEL CARRIL	PRIMARIO	PRIMERA	PUBLICO	t
1322	LEANDRO NICEFORO ALEM	700059600	100	SALVADOR MARIA DEL CARRIL	PRIMARIO	SEGUNDA	PUBLICO	t
1323	E.N.I. Nº 65	700104500	100	SALVADOR MARIA DEL CARRIL	INICIAL	TERCERA	PUBLICO	t
1324	NOCTURNA JOHN KENNEDY	700031400	397	ESCUELA DE EDUCACIoN ESPECIAL “MARTINA CHAPANAY”	UEPA	TERCERA	PUBLICO	t
1325	PRESIDENTE DR. ARTURO UMBERTO ILLIA	700015800	102	PRESIDENTE DR. ARTURO UMBERTO ILLIA	PRIMARIO	PRIMERA	PUBLICO	t
1326	ESCUELA TEC. CAP. LAB. N° 27	700068300	102	PRESIDENTE DR. ARTURO UMBERTO ILLIA	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1327	ESCUELA SECUNDARIA PRESIDENTE DR. ARTURO UMBERTO ILLIA	700088700	102	PRESIDENTE DR. ARTURO UMBERTO ILLIA	SECUNDARIO	PRIMERA	PUBLICO	t
1328	E.N.I. Nº 50 PROF MARGARITA RAVIOLI	700094400	102	PRESIDENTE DR. ARTURO UMBERTO ILLIA	INICIAL	SEGUNDA	PUBLICO	t
1329	C.E.N.S. ZONA OESTE	700107700	102	PRESIDENTE DR. ARTURO UMBERTO ILLIA	CENS	TERCERA	PUBLICO	t
1330	DRA. CARMEN PENALOZA DE VARESE	700015900	103	DRA. CARMEN PENALOZA DE VARESE	PRIMARIO	PRIMERA	PUBLICO	t
1331	COLEGIO PROVINCIAL DE CHIMBAS I	700050300	103	DRA. CARMEN PENALOZA DE VARESE	SECUNDARIO	SEGUNDA	PUBLICO	t
1332	E.N.I. Nº 55 GRACIELA MONTES	700096500	103	DRA. CARMEN PENALOZA DE VARESE	INICIAL	PRIMERA	PUBLICO	t
1333	U.E.P.A. N° 10	700024000	104	GRAL. ESTANISLAO SOLER	UEPA	TERCERA	PUBLICO	t
1334	AGUSTIN VICTORIO GNECCO	700059400	104	GRAL. ESTANISLAO SOLER	PRIMARIO	PRIMERA	PUBLICO	t
1335	GRAL. ESTANISLAO SOLER	700059500	104	GRAL. ESTANISLAO SOLER	PRIMARIO	PRIMERA	PUBLICO	t
1336	ANEXO ESC. TEC. CAP. LAB. AGUSTIN DELGADO	700068801	104	GRAL. ESTANISLAO SOLER	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1337	C.E.N.S. LOS TAMARINDOS	700117200	104	GRAL. ESTANISLAO SOLER	CENS	TERCERA	PUBLICO	t
1338	JUAN ENRIQUE PESTALOZZI TURNO MANANA	700016000	105	JUAN ENRIQUE PESTALOZZI	PRIMARIO	PRIMERA	PUBLICO	t
1339	NOCTURNA MAESTRO AUGUSTO ALEJANDRO ORELLANO WALSEN	700050400	105	JUAN ENRIQUE PESTALOZZI	UEPA	TERCERA	PUBLICO	t
1340	JUAN ENRIQUE PESTALOZZI TURNO TARDE	700081400	105	JUAN ENRIQUE PESTALOZZI	PRIMARIO	PRIMERA	PUBLICO	t
1341	E.N.I. Nº 20 PILPINTU	700085000	105	JUAN ENRIQUE PESTALOZZI	INICIAL	PRIMERA	PUBLICO	t
1342	ESCUELA SECUNDARIA JUAN ENRIQUE PESTALOZZI	700116000	105	JUAN ENRIQUE PESTALOZZI	SECUNDARIO	TERCERA	PUBLICO	t
1343	WERFIELD SALINAS	700003600	106	WERFIELD SALINAS	PRIMARIO	PRIMERA	PUBLICO	t
1345	PROVINCIA DE LA RIOJA	700003900	107	PROVINCIA DE LA RIOJA	PRIMARIO	PRIMERA	PUBLICO	t
1346	ANEXO ESC. TEC. CAP. LAB. LEOPOLDO LUGONES	700069201	107	PROVINCIA DE LA RIOJA	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1347	E.N.I. Nº 71 RISAS DEL SOL	700105800	107	PROVINCIA DE LA RIOJA	INICIAL	TERCERA	PUBLICO	t
1348	TRANSITO DE ORO DE RODRIGUEZ	700035500	108	TRANSITO DE ORO DE RODRIGUEZ	PRIMARIO	PRIMERA	PUBLICO	t
1349	ESCUELA SECUNDARIA TRANSITO DE ORO DE RODRIGUEZ	700099300	108	TRANSITO DE ORO DE RODRIGUEZ	SECUNDARIO	TERCERA	PUBLICO	t
1350	J.I.N.Z. Nº 47 ESC TRANSITO DE ORO DE RODRIGUEZ SEDE	700102200	108	TRANSITO DE ORO DE RODRIGUEZ	INICIAL	PRIMERA	PUBLICO	t
1351	ARTURO CAPDEVILA	700035400	109	ARTURO CAPDEVILA	PRIMARIO	PRIMERA	PUBLICO	t
1352	ESCUELA SECUNDARIA ARTURO CAPDEVILA	700092200	109	ARTURO CAPDEVILA	SECUNDARIO	TERCERA	PUBLICO	t
1353	J.I.N.Z. Nº 47 ESC ARTURO CAPDEVILA ANEXO	700102201	109	ARTURO CAPDEVILA	INICIAL	SEGUNDA	PUBLICO	t
1354	13 DE JUNIO	700035300	110	13 DE JUNIO	PRIMARIO	SEGUNDA	PUBLICO	t
1355	E.N.I. Nº 67 DETRAS DEL ARCOIRIS	700105200	110	13 DE JUNIO	INICIAL	TERCERA	PUBLICO	t
1356	ESCUELA SECUNDARIA 13 DE JUNIO	700101300	110	13 DE JUNIO	SECUNDARIO	TERCERA	PUBLICO	t
1357	DR. HONORIO PUEYRREDON	700023900	111	DR. HONORIO PUEYRREDON	PRIMARIO	PRIMERA	PUBLICO	t
1358	J.I.N.Z. Nº 48 ESC DR HONORIO PUEYRREDON SEDE	700102300	111	DR. HONORIO PUEYRREDON	INICIAL	TERCERA	PUBLICO	t
1359	NOCTURNA SOLDADOS DE MALVINAS	700016200	112	REPUBLICA ORIENTAL DEL URUGUAY	UEPA	TERCERA	PUBLICO	t
1360	REPUBLICA ORIENTAL DEL URUGUAY	700050500	112	REPUBLICA ORIENTAL DEL URUGUAY	PRIMARIO	PRIMERA	PUBLICO	t
1361	ESCUELA TEC. CAP. LAB. TAMBOR DE TACUARI	700070300	112	REPUBLICA ORIENTAL DEL URUGUAY	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1362	J.I.N.Z. Nº 48 ESC REPUBLICA ORIENTAL DEL URUGUAY ANEXO	700102301	112	REPUBLICA ORIENTAL DEL URUGUAY	INICIAL	TERCERA	PUBLICO	t
1363	BLAS PARERA	700016300	113	BLAS PARERA	PRIMARIO	PRIMERA	PUBLICO	t
1364	NOCTURNA REPUBLICA ORIENTAL DEL URUGUAY	700016500	113	BLAS PARERA	UEPA	TERCERA	PUBLICO	t
1365	ESC. TEC. CAP. LAB. TAMBOR DE TACUARI (ANEXO)	700070301	113	BLAS PARERA	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1366	HILARIO ASCASUBI	700007200	114	HILARIO ASCASUBI	PRIMARIO	TERCERA	PUBLICO	t
1367	J.I.N.Z. Nº 8 ESC HILARIO ASCASUBI ANEXO	700102604	114	HILARIO ASCASUBI	INICIAL	SEGUNDA	PUBLICO	t
1368	ANTARTIDA ARGENTINA	700007100	115	ANTARTIDA ARGENTINA	PRIMARIO	TERCERA	PUBLICO	t
1369	J.I.N.Z. Nº 8 ESC ANTARTIDA ARGENTINA ANEXO	700102603	115	ANTARTIDA ARGENTINA	INICIAL	SEGUNDA	PUBLICO	t
1370	ESCUELA SECUNDARIA ANGUALASTO	700100800	115	ANTARTIDA ARGENTINA	SECUNDARIO	TERCERA	PUBLICO	t
1371	MIGUEL CANE	700038900	116	ALBERGUE MIGUEL CANE	ALBERGUE	TERCERA	PUBLICO	t
1372	JUAN JOSE DE VERTIZ	700006600	117	JUAN JOSE DE VERTIZ	PRIMARIO	TERCERA	PUBLICO	t
1373	ANEXO ESC. TEC. CAP. LAB. N° 25  HELLEN KELLER	700066901	117	JUAN JOSE DE VERTIZ	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1374	J.I.N.Z. Nº 6 ESC JUAN JOSE DE VERTIZ ANEXO	700102001	117	JUAN JOSE DE VERTIZ	INICIAL	SEGUNDA	PUBLICO	t
1375	DALMACIO VELEZ SARSFIELD	700007500	118	DALMACIO VELEZ SARSFIELD	PRIMARIO	TERCERA	PUBLICO	t
1376	J.I.N.Z. Nº 8 ESC DALMACIO VELEZ SARFIELD ANEXO	700102602	118	DALMACIO VELEZ SARSFIELD	INICIAL	SEGUNDA	PUBLICO	t
1377	17 DE AGOSTO	700006800	119	17 DE AGOSTO	PRIMARIO	TERCERA	PUBLICO	t
1378	J.I.N.Z. Nº 6 ESC 17 DE AGOSTO SEDE	700102000	119	17 DE AGOSTO	INICIAL	PRIMERA	PUBLICO	t
1379	ESCUELA SECUNDARIA 17 DE AGOSTO	700115800	119	17 DE AGOSTO	SECUNDARIO	TERCERA	PUBLICO	t
1380	PROVINCIA DE SANTA CRUZ	700024500	120	PROVINCIA DE SANTA CRUZ	PRIMARIO	PRIMERA	PUBLICO	t
1381	UEPA IGLESIA	700097000	120	PROVINCIA DE SANTA CRUZ	UEPA	TERCERA	PUBLICO	t
1382	ESCUELA AGROTECNICA CORNELIO SAAVEDRA	700007600	121	ESCUELA AGROTECNICA CORNELIO SAAVEDRA	AGROTECNICA	SEGUNDA	PUBLICO	t
1383	RICARDO GUIRALDES	700007800	122	RICARDO GUIRALDES	PRIMARIO	TERCERA	PUBLICO	t
1384	ESCUELA TEC. CAP. LAB. N° 24	700072900	122	RICARDO GUIRALDES	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1385	J.I.N.Z. Nº 6 ESC RICARDO GUIRALDES ANEXO	700102003	122	RICARDO GUIRALDES	INICIAL	SEGUNDA	PUBLICO	t
1386	ESCUELA SECUNDARIA RICARDO GUIRALDES	700105000	122	RICARDO GUIRALDES	SECUNDARIO	TERCERA	PUBLICO	t
1387	YAPEYU	700006700	123	YAPEYU	PRIMARIO	TERCERA	PUBLICO	t
1388	ESCUELA SECUNDARIA BACHILLERATO COLUMNA CABOT	700062300	123	YAPEYU	SECUNDARIO	TERCERA	PUBLICO	t
1389	PROPAA ZONA NORTE UNIDAD EDUCATIVA N° 26	700066219	123	YAPEYU	\N	\N	\N	t
1390	ESCUELA TEC. CAP. LAB. N° 25 HELLEN KELLER	700066900	123	YAPEYU	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1391	J.I.N.Z. Nº 6 ESC YAPEYU ANEXO	700102004	123	YAPEYU	INICIAL	SEGUNDA	PUBLICO	t
1392	C.E.N.S. 178 PRESBiTERO MARIANO IANNELLI	700009500	124	ANTONIO QUARANTA	CENS	TERCERA	PUBLICO	t
1393	ANTONIO QUARANTA	700041900	124	ANTONIO QUARANTA	PRIMARIO	PRIMERA	PUBLICO	t
1394	U.E.P.A. N° 5	700041600	125	GRAL. SAN MARTIN	UEPA	TERCERA	PUBLICO	t
1395	GRAL. SAN MARTIN	700045200	125	GRAL. SAN MARTIN	PRIMARIO	PRIMERA	PUBLICO	t
1396	ESCUELA TEC. CAP. LAB. GREGORIA MATORRAS DE SAN MARTIN	700066600	125	GRAL. SAN MARTIN	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1397	E.N.I. Nº 58 WASI KUSI	700098600	125	GRAL. SAN MARTIN	INICIAL	PRIMERA	PUBLICO	t
1398	E.P.E.T. N° 1 JACHAL	700045100	126	E.P.E.T. N° 1 JACHAL	TECNICO	PRIMERA	PUBLICO	t
1399	AGROTECNICA DR. MANUEL BELGRANO	700045300	127	AGROTECNICA DR. MANUEL BELGRANO	AGROTECNICA	PRIMERA	PUBLICO	t
1400	ESCUELA E.E.E. ABEJITAS DE SANTA RITA	700041400	128	ESCUELA E.E.E. ABEJITAS DE SANTA RITA	EDUCACION ESPECIAL	SEGUNDA	PUBLICO	t
1401	JOSE MATIAS ZAPIOLA	700051900	129	JOSE MATIAS ZAPIOLA	PRIMARIO	TERCERA	PUBLICO	t
1402	ESCUELA DE NIVEL MEDIO DE NIQUIVIL	700052100	129	JOSE MATIAS ZAPIOLA	SECUNDARIO	TERCERA	PUBLICO	t
1403	ESCUELA TEC. CAP. LAB. N° 26 LUIS SAENZ PENA	700071700	129	JOSE MATIAS ZAPIOLA	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1404	J.I.N.Z. Nº 18 ESC JOSE MATIAS ZAPIOLA SEDE	700096200	129	JOSE MATIAS ZAPIOLA	INICIAL	PRIMERA	PUBLICO	t
1405	DEAN GREGORIO FUNES - EMER	700040800	130	DEAN GREGORIO FUNES EMER	PRIMARIO	TERCERA	PUBLICO	t
1406	J.I.N.Z. Nº 16 ESC DEAN GREGORIO FUNES ANEXO	700096003	130	DEAN GREGORIO FUNES EMER	INICIAL	TERCERA	PUBLICO	t
1407	ANTENOR FLORES VIDAL	700009300	131	ANTENOR FLORES VIDAL	PRIMARIO	TERCERA	PUBLICO	t
1408	J.I.N.Z. Nº 18 ESC ANTENOR FLORES VIDAL ANEXO	700096203	131	ANTENOR FLORES VIDAL	INICIAL	TERCERA	PUBLICO	t
1409	MONSENOR TOMAS S. CRUZ	700051800	132	MONSENOR TOMAS S. CRUZ	PRIMARIO	TERCERA	PUBLICO	t
1410	J.I.N.Z. Nº 18 ESC MONSENOR TOMAS S. CRUZ ANEXO	700096206	132	MONSENOR TOMAS S. CRUZ	INICIAL	TERCERA	PUBLICO	t
1411	RUBEN DARIO - EMER	700009700	133	RUBEN DARIO EMER	PRIMARIO	TERCERA	PUBLICO	t
1412	J.I.N.Z. Nº 19 ESC RUBEN DARIO ANEXO	700096304	133	RUBEN DARIO EMER	INICIAL	SEGUNDA	PUBLICO	t
1413	PROVINCIA DE ENTRE RIOS	700051200	134	ALBERGUE PROVINCIA DE ENTRE RIOS	ALBERGUE	TERCERA	PUBLICO	t
1414	DR. FEDERICO CANTONI	700016900	135	ALBERGE DR. FEDERICO CANTONI	ALBERGUE	TERCERA	PUBLICO	t
1415	AGROTECNICA HUACO	700050900	135	DR. FEDERICO CANTONI	AGROTECNICA	TERCERA	PUBLICO	t
1416	ANEXO ESC. TEC. CAP. LAB. ARTURO MARASSO (HUACO)	700066701	135	DR. FEDERICO CANTONI	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1417	J.I.N.Z. Nº 16 ESC DR. FEDERICO CANTON ANEXO	700096004	135	DR. FEDERICO CANTONI	INICIAL	TERCERA	PUBLICO	t
1418	BUENAVENTURA LUNA - EMER	700016700	136	BUENAVENTURA LUNA  EMER	PRIMARIO	TERCERA	PUBLICO	t
1419	ESCUELA E.E. ABEJITAS DE SANTA RITA ANEXO E.E.E. MULTIPLE ABEJITAS DE SANTA RITA	700041401	136	BUENAVENTURA LUNA  EMER	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
1420	J.I.N.Z. Nº 16 ESC BUENAVENTURA LUNA ANEXO	700096002	136	BUENAVENTURA LUNA  EMER	INICIAL	TERCERA	PUBLICO	t
1421	DR. ALFREDO CALCAGNO - EMER	700016800	137	DR. ALFREDO CALCAGNO  EMER	PRIMARIO	TERCERA	PUBLICO	t
1422	J.I.N.Z. Nº 16 ESCDR. ALFREDO CALCAGNO ANEXO	700096005	137	DR. ALFREDO CALCAGNO  EMER	INICIAL	TERCERA	PUBLICO	t
1423	ONOFRE ILLANES	700017000	138	ONOFRE ILLANES	PRIMARIO	TERCERA	PUBLICO	t
1424	J.I.N.Z. Nº 16 ESC ONOFRE ILLANES ANEXO	700096001	138	ONOFRE ILLANES	INICIAL	TERCERA	PUBLICO	t
1425	JOSE MARMOL	700009900	139	JOSE MARMOL	PRIMARIO	TERCERA	PUBLICO	t
1426	J.I.N.Z. Nº 16 ESC JOSE MARMOL SEDE	700096000	139	JOSE MARMOL	INICIAL	TERCERA	PUBLICO	t
1427	MARCOS SASTRE - EMER	700009800	140	MARCOS SASTRE  EMER	PRIMARIO	TERCERA	PUBLICO	t
1428	J.I.N.Z. Nº 19 ESC MARCOS SASTRE ANEXO	700096301	140	MARCOS SASTRE  EMER	INICIAL	SEGUNDA	PUBLICO	t
1429	ALMIRANTE RAMON GONZALEZ FERNANDEZ - EMER	700041000	141	ALMIRANTE RAMON GONZALEZ FERNANDEZ  EMER	PRIMARIO	TERCERA	PUBLICO	t
1430	ESCUELA DE NIVEL MEDIO PAMPA VIEJA	700041100	141	ALMIRANTE RAMON GONZALEZ FERNANDEZ EMER	SECUNDARIO	TERCERA	PUBLICO	t
1431	ANEXO ESC. TEC. CAP. LAB. GREGORIA DE SAN MARTIN PAMPA	700066601	141	ALMIRANTE RAMON GONZALEZ FERNANDEZ EMER	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1432	J.I.N.Z. Nº 3 ESC ALMIRANTE RAMON GONZALEZ FERNANDEZ ANEXO	700094303	141	ALMIRANTE RAMON GONZALEZ FERNANDEZ EMER	INICIAL	PRIMERA	PUBLICO	t
1433	GABRIEL ALBARRACIN	700042200	142	GABRIEL ALBARRACIN EMER	PRIMARIO	TERCERA	PUBLICO	t
1434	J.I.N.Z. Nº 19 ESC GABRIEL ALBARRACIN ANEXO	700096306	142	GABRIEL ALBARRACIN EMER	INICIAL	SEGUNDA	PUBLICO	t
1435	ESCUELA SECUNDARIA GABRIEL ALBARRACIN	700112100	142	GABRIEL ALBARRACIN EMER	SECUNDARIO	TERCERA	PUBLICO	t
1436	LORENZO LUZURIAGA	700044600	143	LORENZO LUZURIAGA	PRIMARIO	TERCERA	PUBLICO	t
1437	J.I.N.Z. Nº 18 ESC LORENZO LUZURIAGA ANEXO	700096204	143	LORENZO LUZURIAGA	INICIAL	TERCERA	PUBLICO	t
1438	CAPITAN DE FRAGATA HIPOLITO BUCHARDO	700044500	144	CAPITAN DE FRAGATA HIPOLITO BUCHARDO	PRIMARIO	TERCERA	PUBLICO	t
1439	J.I.N.Z. Nº 18 ESC CAPITAN DE FRAGATA HIPOLITO BUCHARDO ANEXO	700096205	144	CAPITAN DE FRAGATA HIPOLITO BUCHARDO	INICIAL	TERCERA	PUBLICO	t
1440	BIENVENIDA SARMIENTO	700051100	145	BIENVENIDA SARMIENTO	PRIMARIO	TERCERA	PUBLICO	t
1441	J.I.N.Z. Nº 17  BIENVENIDA SARMIENTO ANEXO	700096101	145	BIENVENIDA SARMIENTO	INICIAL	TERCERA	PUBLICO	t
1442	AGUSTIN GOMEZ	700010000	146	AGUSTIN GOMEZ	PRIMARIO	TERCERA	PUBLICO	t
1443	J.I.N.Z. Nº 19 AGUSTIN GOMEZ ANEXO	700096305	146	AGUSTIN GOMEZ	INICIAL	SEGUNDA	PUBLICO	t
1444	DR. DANIEL SEGUNDO AUBONE	700010200	147	DR. DANIEL SEGUNDO AUBONE	PRIMARIO	TERCERA	PUBLICO	t
1445	J.I.N.Z. Nº 19 ESC DR. DANIEL SEGUNDO AUBONE ANEXO	700096303	147	DR. DANIEL SEGUNDO AUBONE	INICIAL	SEGUNDA	PUBLICO	t
1446	AGROINDUSTRIAL MONS.DR.JUAN A.VIDELA CUELLO	700040500	148	AGROINDUSTRIAL MONS. DR.JUAN ANTONIO VIDELA CUELLO	AGROTECNICA	TERCERA	PUBLICO	t
1447	ESCUELA TEC. CAP. LAB. ARTURO MARASSO	700066700	148	AGROINDUSTRIAL MONS. DR.JUAN ANTONIO VIDELA CUELLO	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1448	JOAQUIN V. GONZALEZ	700041200	149	ALBERGUE JOAQUIN V. GONZALEZ	ALBERGUE	TERCERA	PUBLICO	t
1449	J.I.N.Z. Nº 19 ESC  ALBERGUE JOAQUIN V. GONZALEZ ANEXO	700096307	149	ALBERGUE JOAQUIN V. GONZALEZ	INICIAL	SEGUNDA	PUBLICO	t
1450	PROVINCIA DE LA PAMPA	700041500	150	PROVINCIA DE LA PAMPA	PRIMARIO	PRIMERA	PUBLICO	t
1451	J.I.N.Z. Nº 17 ESC PROVINCIA DE LA PAMPA ANEXO	700096102	150	PROVINCIA DE LA PAMPA	INICIAL	TERCERA	PUBLICO	t
1452	INSTITUTO SUPERIOR DE SAN ISIDRO	700040400	149	JOAQUIN V. GONZALEZ	SUPERIOR	PRIMERA	PUBLICO	t
1453	JUAN DE ECHEGARAY	700052000	151	JUAN DE ECHEGARAY	PRIMARIO	TERCERA	PUBLICO	t
1454	J.I.N.Z. Nº 18  ESC  JUAN DE ECHEGARAY ANEXO	700096201	151	JUAN DE ECHEGARAY	INICIAL	TERCERA	PUBLICO	t
1455	PEDRO BONIFACIO PALACIOS	700040700	152	PEDRO BONIFACIO PALACIOS	PRIMARIO	SEGUNDA	PUBLICO	t
1456	U.E.P.A. N° 5 ANEXO PEDRO BONIFACIO PALACIOS	700041601	152	PEDRO BONIFACIO PALACIOS	UEPA	TERCERA	PUBLICO	t
1457	ANEXO ESC. TEC. CAP. LAB. ARTURO MARASSO (TAMBERIAS)	700066702	152	PEDRO BONIFACIO PALACIOS	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1458	J.I.N.Z. Nº 3 ESC PEDRO BONIFACIO PALACIOS ANEXO	700094302	152	PEDRO BONIFACIO PALACIOS	INICIAL	PRIMERA	PUBLICO	t
1459	ESCUELA SECUNDARIA PEDRO BONIFACIO PALACIOS	700098100	152	PEDRO BONIFACIO PALACIOS	SECUNDARIO	TERCERA	PUBLICO	t
1460	24 DE SEPTIEMBRE - EMER	700011700	153	24 DE SEPTIEMBRE  EMER	PRIMARIO	PRIMERA	PUBLICO	t
1461	C.E.N.S. HEBE FIGUEROA	700040900	153	24 DE SEPTIEMBRE  EMER	CENS	TERCERA	PUBLICO	t
1462	J.I.N.Z. Nº 3 ESC 24 DE SEPTIEMBRE ANEXO	700094301	153	24 DE SEPTIEMBRE  EMER	INICIAL	PRIMERA	PUBLICO	t
1463	FRONTERAS ARGENTINAS	700017100	154	FRONTERAS ARGENTINAS	PRIMARIO	TERCERA	PUBLICO	t
1464	ESCUELA DE COMERCIO EUSEBIO DE JESUS DOJORTI	700051600	154	FRONTERAS ARGENTINAS	SECUNDARIO	PRIMERA	PUBLICO	t
1465	J.I.N.Z. Nº 17 ESC FRONTERAS ARGENTINAS SEDE	700096100	154	FRONTERAS ARGENTINAS	INICIAL	TERCERA	PUBLICO	t
1466	JUAN MARIA GUTIERREZ - EMER	700051000	155	JUAN MARIA GUTIERREZ  EMER	PRIMARIO	TERCERA	PUBLICO	t
1467	J.I.N.Z. Nº 19 ESC JUAN MARIA GUTIERREZ ANEXO	700096308	155	JUAN MARIA GUTIERREZ  EMER	INICIAL	PRIMERA	PUBLICO	t
1468	AGROTeCNICA PROF. ANA PEREZ CIANI	700021600	156	ESCUELA AGROTECNICA ANA PEREZ CIANI	AGROTECNICA	TERCERA	PUBLICO	t
1469	EUSEBIO SEGUNDO ZAPATA	700021400	157	EUSEBIO SEGUNDO ZAPATA	PRIMARIO	TERCERA	PUBLICO	t
1470	J.I.N.Z. Nº 32 ESC EUSEBIO SEGUNDO ZAPATA SEDE	700103000	157	EUSEBIO SEGUNDO ZAPATA	INICIAL	PRIMERA	PUBLICO	t
1471	ANEXO NOCTURNA DR. RICARDO BALBIN	700021201	158	DR. LUIS AGOTE	UEPA	TERCERA	PUBLICO	t
1472	DR. LUIS AGOTE	700039500	158	DR. LUIS AGOTE	PRIMARIO	PRIMERA	PUBLICO	t
1473	ANEXO ESC. TEC. CAP. LAB. DOMINGO MATHEU	700066801	158	DR. LUIS AGOTE	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1474	J.I.N.Z. Nº 32  ESC DR. LUIS AGOTE ANEXO	700103004	158	DR. LUIS AGOTE	INICIAL	PRIMERA	PUBLICO	t
1475	C.E.N.S. LAS CHACRITAS	700112700	158	DR. LUIS AGOTE	CENS	TERCERA	PUBLICO	t
1476	PROCESA SARMIENTO DE LENOIR	700039400	159	PROCESA SARMIENTO DE LENOIR	PRIMARIO	SEGUNDA	PUBLICO	t
1477	ESC. ED.SECUNDARIA PROCESA SARMIENTO DE LENOIR	700089100	159	PROCESA SARMIENTO DE LENOIR	SECUNDARIO	TERCERA	PUBLICO	t
1478	J.I.N.Z. Nº 32  ESC PROCESA SARMIENTO DE LENOIR ANEXO	700103005	159	PROCESA SARMIENTO DE LENOIR	INICIAL	PRIMERA	PUBLICO	t
1479	ESTEBAN DE LUCA	700021300	160	ESTEBAN DE LUCA	PRIMARIO	TERCERA	PUBLICO	t
1480	J.I.N.Z. Nº 32  ESC ESTEBAN DE LUCA ANEXO	700103003	160	ESTEBAN DE LUCA	INICIAL	PRIMERA	PUBLICO	t
1481	GRANADEROS DE SAN MARTIN	700056500	161	GRANADEROS DE SAN MARTIN	PRIMARIO	PRIMERA	PUBLICO	t
1482	ESCUELA TEC. CAP. LAB. JORGE HUMBERTO YACANTE	700073700	161	GRANADEROS DE SAN MARTIN	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1483	C.E.N.S. JORGE H. YACANTE	700097500	161	GRANADEROS DE SAN MARTIN	CENS	TERCERA	PUBLICO	t
1484	E.N.I. Nº 66 PEQUENOS GRANADEROS	700104600	161	GRANADEROS DE SAN MARTIN	INICIAL	PRIMERA	PUBLICO	t
1485	BATALLA DE TUCUMAN	700056100	162	BATALLA DE TUCUMAN	PRIMARIO	TERCERA	PUBLICO	t
1486	ESCUELA TECNICA DE CAPACITACION LABORAL INT. JOAQUIN UNAC	700068600	162	BATALLA DE TUCUMAN	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1487	ESCUELA SECUNDARIA BATALLA DE TUCUMAN	700100300	162	BATALLA DE TUCUMAN	SECUNDARIO	TERCERA	PUBLICO	t
1488	J.I.N.Z. Nº 27 ESC BATALLA DE TUCUMAN SEDE	700104100	162	BATALLA DE TUCUMAN	INICIAL	PRIMERA	PUBLICO	t
1489	MAESTRO ARGENTINO	700020000	163	MAESTRO ARGENTINO	PRIMARIO	TERCERA	PUBLICO	t
1490	J.I.N.Z. Nº 26  MAESTRO ARGENTINO ANEXO	700104402	163	MAESTRO ARGENTINO	INICIAL	PRIMERA	PUBLICO	t
1491	ANEXO ESCUELA NOCTURNA MINERO SANJUANINO	700008701	164	CARLOS N. VERGARA EMER	UEPA	TERCERA	PUBLICO	t
1492	ESCUELA COMERCIO SIXTO SALINAS DE RIVERA	700020100	164	CARLOS N. VERGARA EMER	SECUNDARIO	SEGUNDA	PUBLICO	t
1493	CARLOS N. VERGARA - EMER	700020400	164	CARLOS N. VERGARA EMER	PRIMARIO	PRIMERA	PUBLICO	t
1494	J.I.N.Z. Nº 26 ESC CARLOS N VERGARA ANEXO	700104401	164	CARLOS N. VERGARA EMER	INICIAL	PRIMERA	PUBLICO	t
1495	DR. ALBERT SCHWEITZER	700019900	165	DR. ALBERT SCHWEITZER	PRIMARIO	SEGUNDA	PUBLICO	t
1496	ANEXO ESCUELA TECNICA DE CAPACITACION LABORAL INT. JOAQUIN UNAC    EX - ESCUELA TEC. CAP. LAB. N° 4	700068601	165	DR. ALBERT SCHWEITZER	\N	\N	\N	t
1497	J.I.N.Z. Nº 27 ESC ALBERT SCHWEITZER ANEXO	700104103	165	DR. ALBERT SCHWEITZER	INICIAL	PRIMERA	PUBLICO	t
1498	PEDRO DE VALDIVIA	700020200	166	PEDRO DE VALDIVIA	PRIMARIO	TERCERA	PUBLICO	t
1499	J.I.N.Z. Nº 26 ESC PEDRO DE VALDIVIA SEDE	700104400	166	PEDRO DE VALDIVIA	INICIAL	PRIMERA	PUBLICO	t
1500	JUSTO JOSE DE URQUIZA	700033900	167	JUSTO JOSE DE URQUIZA	PRIMARIO	TERCERA	PUBLICO	t
1501	ESCUELA SECUNDARIA JUSTO JOSE DE URQUIZA	700094500	167	JUSTO JOSE DE URQUIZA	SECUNDARIO	TERCERA	PUBLICO	t
1502	J.I.N.Z. Nº 29  ESC JUSTO JOSE DE URQUIZA ANEXO	700103103	167	JUSTO JOSE DE URQUIZA	INICIAL	PRIMERA	PUBLICO	t
1503	TIERRA DEL FUEGO	700019800	168	TIERRA DEL FUEGO	PRIMARIO	TERCERA	PUBLICO	t
1504	J.I.N.Z. Nº 28 ESC TIERRA DEL FUEGO SEDE	700104200	168	TIERRA DEL FUEGO	INICIAL	TERCERA	PUBLICO	t
1505	J.I.N.Z. Nº 30  ESC DR. CARLOS SAAVEDRA LAMAS ANEXO	700103202	169	DR. CARLOS SAAVEDRA LAMAS	INICIAL	PRIMERA	PUBLICO	t
1506	DR. CARLOS SAAVEDRA LAMAS	700034300	169	DR. CARLOS SAAVEDRA LAMAS	PRIMARIO	TERCERA	PUBLICO	t
1507	LUIS VERNET	700019700	170	LUIS VERNET	PRIMARIO	SEGUNDA	PUBLICO	t
1508	J.I.N.Z. Nº 27 ESC LUIS VERNET ANEXO	700104102	170	LUIS VERNET	INICIAL	PRIMERA	PUBLICO	t
1509	PEDRO ALVAREZ	700055900	171	PEDRO ALVAREZ	PRIMARIO	SEGUNDA	PUBLICO	t
1510	ESCUELA SECUNDARIA PEDRO ALVAREZ	700101100	171	PEDRO ALVAREZ	SECUNDARIO	TERCERA	PUBLICO	t
1511	J.I.N.Z. Nº 26  ESC PEDRO ALVAREZ ANEXO	700104404	171	PEDRO ALVAREZ	INICIAL	PRIMERA	PUBLICO	t
1512	GRAL. MARTIN MIGUEL DE GUEMES	700034500	172	GRAL. MARTIN MIGUEL DE GUEMES	PRIMARIO	TERCERA	PUBLICO	t
1513	ESCUELA SECUNDARIA GRAL. MARTIN MIGUEL DE GUEMES	700101200	172	GRAL. MARTIN MIGUEL DE GUEMES	SECUNDARIO	TERCERA	PUBLICO	t
1514	J.I.N.Z. Nº 28  GRAL. MARTIN MIGUEL DE GUEMES ANEXO	700104202	172	GRAL. MARTIN MIGUEL DE GUEMES	INICIAL	TERCERA	PUBLICO	t
1515	12 DE AGOSTO	700034400	173	12 DE AGOSTO	PRIMARIO	SEGUNDA	PUBLICO	t
1516	J.I.N.Z. Nº 30  ESC 12 DE AGOSTO ANEXO	700103204	173	12 DE AGOSTO	INICIAL	PRIMERA	PUBLICO	t
1517	ESCUELA SECUNDARIA 12 DE AGOSTO	700109400	173	12 DE AGOSTO	SECUNDARIO	TERCERA	PUBLICO	t
1518	JOSE RUDECINDO ROJO	700019600	174	JOSE RUDECINDO ROJO	PRIMARIO	PRIMERA	PUBLICO	t
1519	ESCUELA TEC. CAP. LAB. JOSE RUDECINDO ROJO	700067500	174	JOSE RUDECINDO ROJO	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1520	GRAL. MARIANO ACHA	700003300	175	GRAL. MARIANO ACHA	PRIMARIO	TERCERA	PUBLICO	t
1521	J.I.N.Z. Nº 29 ESC GENERAL MARIANO ACHA SEDE	700103100	175	GRAL. MARIANO ACHA	INICIAL	PRIMERA	PUBLICO	t
1522	JOSE MARIA TORRES	700003400	176	JOSE MARIA TORRES	PRIMARIO	PRIMERA	PUBLICO	t
1523	ESCUELA DE EDUCACION SECUNDARIA JOSE MARIA TORRES	700084600	176	JOSE MARIA TORRES	SECUNDARIO	PRIMERA	PUBLICO	t
1524	E.N.I. Nº 33 MARIA LAURA DEVETACH	700087300	176	JOSE MARIA TORRES	INICIAL	PRIMERA	PUBLICO	t
1525	ESPANA	700020700	177	ESPANA	PRIMARIO	PRIMERA	PUBLICO	t
1526	PROPAA ZONA SUR CAP 81	700066126	177	ESPANA	\N	\N	\N	t
1527	ESCUELA SECUNDARIA ESPANA	700080500	177	ESPANA	SECUNDARIO	PRIMERA	PUBLICO	t
1528	E.N.I. Nº 76 LAURA LEWIN	700111300	177	ESPANA	INICIAL	TERCERA	PUBLICO	t
1529	DR. ANTONINO  ABERASTAIN	700020600	178	DR. ANTONINO  ABERASTAIN	PRIMARIO	PRIMERA	PUBLICO	t
1530	INGENIERO MARCO ANTONIO ZALAZAR	700056200	178	DR. ANTONINO  ABERASTAIN	PRIMARIO	PRIMERA	PUBLICO	t
1531	NOCTURNA DR. ANTONINO ABERASTAIN	700056400	178	DR. ANTONINO  ABERASTAIN	UEPA	TERCERA	PUBLICO	t
1532	ESCUELA TEC. CAP. LAB. MAGDALENA B. DE ABERASTAIN	700071400	178	DR. ANTONINO  ABERASTAIN	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1533	CONTRA ALMIRANTE ELEAZAR VIDELA	700056300	179	CONTRALMIRANTE ELEAZAR VIDELA	PRIMARIO	PRIMERA	PUBLICO	t
1534	J.I.N.Z. Nº 27 ESC CONTRALMIRANTE ELEAZAR VIDELA ANEXO	700104101	179	CONTRALMIRANTE ELEAZAR VIDELA	INICIAL	PRIMERA	PUBLICO	t
1535	COLEGIO SECUNDARIO PROFESOR FROILAN JAVIER FERRERO	700020800	180	COL. SEC. PROFESOR FROILAN JAVIER FERRERO	SECUNDARIO	PRIMERA	PUBLICO	t
1536	C.E.N.S. POCITO	700020900	180	COL. SEC. PROFESOR FROILAN JAVIER FERRERO	CENS	TERCERA	PUBLICO	t
1537	ESCUELA NORMAL SUPERIOR SARMIENTO ANEXO	700025401	180	COL. SEC. PROFESOR FROILAN JAVIER FERRERO	SUPERIOR	CUARTA	PUBLICO	t
1538	INSTITUTO TECNICO SUPERIOR DE GESTION SARMIENTO	700075900	270	AGROTECNICA SARMIENTO	SUPERIOR	TERCERA	PUBLICO	t
1539	RABINDRANATH TAGORE	700034200	181	RABINDRANATH TAGORE	PRIMARIO	PRIMERA	PUBLICO	t
1540	NOCTURNA JUSTO JOSE DE URQUIZA	700034600	181	RABINDRANATH TAGORE	UEPA	TERCERA	PUBLICO	t
1541	ANEXO ESC. TEC. CAP. LAB. INGENIERO DOMINGO KRAUSE	700070501	181	RABINDRANATH TAGORE	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1542	C.E.N.S. INGENIERO DOMINGO KRAUSE	700096900	181	RABINDRANATH TAGORE	CENS	TERCERA	PUBLICO	t
1543	J.I.N.Z. Nº 29  ESC RABINDRANATH TAGORE ANEXO	700103101	181	RABINDRANATH TAGORE	INICIAL	PRIMERA	PUBLICO	t
1544	ESCUELA SECUNDARIA RABINDRANATH TAGORE	700110100	181	RABINDRANATH TAGORE	SECUNDARIO	TERCERA	PUBLICO	t
1545	FRAY LUIS BELTRAN	700030000	182	FRAY LUIS BELTRAN	PRIMARIO	SEGUNDA	PUBLICO	t
1546	E.N.I. Nº 75 ELENA SANTA CRUZ	700114000	182	FRAY LUIS BELTRAN	INICIAL	TERCERA	PUBLICO	t
1547	MARCELINO GUARDIOLA	700036900	183	MARCELINO GUARDIOLA	PRIMARIO	PRIMERA	PUBLICO	t
1548	ESCUELA SECUNDARIA MARCELINO GUARDIOLA	700101800	183	MARCELINO GUARDIOLA	SECUNDARIO	TERCERA	PUBLICO	t
1549	J.I.N.Z. Nº 52  ESC MARCELINO GUARDIOLA ANEXO	700113704	183	MARCELINO GUARDIOLA	INICIAL	PRIMERA	PUBLICO	t
1550	MARY OLSTINE GRAHAM	700030100	184	MARY O GRAHAM	PRIMARIO	PRIMERA	PUBLICO	t
1551	E.N.I. Nº 45 MARTA GRAHAM	700089800	184	MARY O GRAHAM	INICIAL	PRIMERA	PUBLICO	t
1552	EUGENIA BELIN SARMIENTO	700005500	185	EUGENIA BELIN SARMIENTO	PRIMARIO	PRIMERA	PUBLICO	t
1553	ESCUELA TEC. CAP. LAB. TERESA DE ASCENCIO DE DE MALLEA	700071100	185	EUGENIA BELIN SARMIENTO	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1554	ESCUELA SECUNDARIA EUGENIA BELIN SARMIENTO	700089300	185	EUGENIA BELIN SARMIENTO	SECUNDARIO	PRIMERA	PUBLICO	t
1555	NOCTURNA ALMIRANTE BROWN	700002000	419	BARRIO VALLE GRANDE TURNO MANANA	UEPA	TERCERA	PUBLICO	t
1556	GABRIELA MISTRAL	700002100	186	GABRIELA MISTRAL	PRIMARIO	PRIMERA	PUBLICO	t
1557	JOSE HERNANDEZ	700002200	186	GABRIELA MISTRAL	PRIMARIO	PRIMERA	PUBLICO	t
1558	ESCUELA TEC. CAP. LAB. JUAN PABLO ECHAGUE	700068400	186	GABRIELA MISTRAL	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1559	E.N.I. Nº 51 TIEMPO DE SOL	700093600	186	GABRIELA MISTRAL	INICIAL	PRIMERA	PUBLICO	t
1560	ANTONIO DE LA TORRE	700004700	187	ANTONIO DE LA TORRE	PRIMARIO	PRIMERA	PUBLICO	t
1561	PROPAA ZONA SUR PROPAA - CAP 14 CIC VILLA KRAUSE	700066107	187	ANTONIO DE LA TORRE	PROPAA	CUARTA	PUBLICO	t
1562	E.N.I. Nº 36 MILO LOCKETT	700087500	187	ANTONIO DE LA TORRE	INICIAL	PRIMERA	PUBLICO	t
1563	E.P.E.T. N° 3  SAN JUAN	700032200	188	E.P.E.T. N° 3 SAN JUAN	TECNICO	PRIMERA	PUBLICO	t
1564	TENIENTE GRAL. PEDRO EUGENIO ARAMBURU	700006500	189	TTE. GRAL. PEDRO EUGENIO ARAMBURU	PRIMARIO	PRIMERA	PUBLICO	t
1565	PRESIDENTE JUAN DOMINGO PERON	700038800	189	TTE. GRAL. PEDRO EUGENIO ARAMBURU	PRIMARIO	PRIMERA	PUBLICO	t
1566	ESCUELA TEC. CAP. LAB. NINAS DE AYOHUMA	700071600	189	TTE. GRAL. PEDRO EUGENIO ARAMBURU	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1567	E.N.I. Nº 34 MAGDALENA GUEMES	700087400	189	TTE. GRAL. PEDRO EUGENIO ARAMBURU	INICIAL	PRIMERA	PUBLICO	t
1568	U.E.P.A. N° 9	700005100	190	SAN JUAN EUDES	UEPA	TERCERA	PUBLICO	t
1569	SAN JUAN EUDES	700005400	190	SAN JUAN EUDES	PRIMARIO	SEGUNDA	PUBLICO	t
1570	E.N.I. Nº  28 SAN JUAN BAUTISTA	700086600	190	SAN JUAN EUDES	INICIAL	PRIMERA	PUBLICO	t
1571	SATURNINO SARASSA	700037500	191	SATURNINO SARASSA	PRIMARIO	PRIMERA	PUBLICO	t
1572	E.N.I. Nº 26 TAYNEMTA	700086300	191	SATURNINO SARASSA	INICIAL	PRIMERA	PUBLICO	t
1573	ESCUELA SECUNDARIA SATURNINO SARASSA	700100500	191	SATURNINO SARASSA	SECUNDARIO	TERCERA	PUBLICO	t
1574	NOCTURNA ANGEL SALVADOR MARTIN	700001800	192	11 DE SETIEMBRE	UEPA	TERCERA	PUBLICO	t
1575	JUAN XXIII	700001900	192	11 DE SETIEMBRE	PRIMARIO	SEGUNDA	PUBLICO	t
1576	11 DE SEPTIEMBRE	700030200	192	11 DE SETIEMBRE	PRIMARIO	PRIMERA	PUBLICO	t
1577	ESCUELA TEC. CAP. LAB. ROBERTO J. PAYRO	700072200	192	11 DE SETIEMBRE	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1578	ESCUELA SECUNDARIA JUAN XXIII	700083200	192	11 DE SETIEMBRE	SECUNDARIO	PRIMERA	PUBLICO	t
1579	E.N.I. Nº 52 RUTH HARF	700094600	192	11 DE SETIEMBRE	INICIAL	PRIMERA	PUBLICO	t
1580	PROPAA ZONA SUR CAP 87	700066130	193	14 DE FEBRERO	PROPAA	CUARTA	PUBLICO	t
1581	ESCUELA SECUNDARIA JOSE MANUEL ESTRADA	700093300	193	14 DE FEBRERO	SECUNDARIO	SEGUNDA	PUBLICO	t
1582	14 DE FEBRERO	700030300	193	14 DE FEBRERO	PRIMARIO	PRIMERA	PUBLICO	t
1583	MAESTRO JOSE BERRUTTI	700046400	194	MAESTRO JOSE J. BERRUTTI	PRIMARIO	TERCERA	PUBLICO	t
1584	J.I.N.Z. Nº 50  ESC MAESTRO JOSE JOAQUIN BERRUTTI ANEXO	700113501	194	MAESTRO JOSE J. BERRUTTI	INICIAL	PRIMERA	PUBLICO	t
1585	CECILIO AVILA	700012000	195	CECILIO AVILA	PRIMARIO	PRIMERA	PUBLICO	t
1586	DIVINO NInO JESuS	700024300	195	CECILIO AVILA	UEPA	TERCERA	PUBLICO	t
1587	ESCUELA SECUNDARIA CECILIO AVILA	700106000	195	CECILIO AVILA	SECUNDARIO	TERCERA	PUBLICO	t
1588	J.I.N.Z. Nº 51  ESC CECILIO AVILA ANEXO	700113601	195	CECILIO AVILA	INICIAL	PRIMERA	PUBLICO	t
1589	PATRICIAS MENDOCINAS	700046700	196	PATRICIAS MENDOCINAS	PRIMARIO	TERCERA	PUBLICO	t
1590	MISION MONOTECNICA Y DE EXTENCION CULTURAL N° 14	700070800	196	PATRICIAS MENDOCINAS	MONOTECNICA	TERCERA	PUBLICO	t
1652	CORNELIO SAAVEDRA TURNO MANANA	700015300	214	CORNELIO SAAVEDRA	PRIMARIO	PRIMERA	PUBLICO	t
1591	ESCUELA SECUNDARIA PATRICIAS MENDOCINAS	700082400	196	PATRICIAS MENDOCINAS	SECUNDARIO	TERCERA	PUBLICO	t
1592	J.I.N.Z. Nº 50 ESCUELA PATRICIAS MENDOCINAS SEDE	700113500	196	PATRICIAS MENDOCINAS	INICIAL	PRIMERA	PUBLICO	t
1593	AMERICA	700046900	197	AMERICA	PRIMARIO	TERCERA	PUBLICO	t
1594	J.I.N.Z. Nº 49  ESC AMERICA ANEXO	700113402	197	AMERICA	INICIAL	CUARTA	PUBLICO	t
1595	ESCUELA AGROTECNICA LOS PIONEROS	700047200	198	JUANA CARDOSO ABERASTAIN	AGROTECNICA	PRIMERA	PUBLICO	t
1596	JUANA CARDOSO ABERASTAIN	700047300	198	JUANA CARDOSO ABERASTAIN	PRIMARIO	TERCERA	PUBLICO	t
1597	J.I.N.Z. Nº 49  ESC JUANA CARDOSO ABERASTAIN ANEXO	700113403	198	JUANA CARDOSO ABERASTAIN	INICIAL	SEGUNDA	PUBLICO	t
1598	PRESIDENTE SARMIENTO	700012200	199	PRESIDENTE SARMIENTO	PRIMARIO	SEGUNDA	PUBLICO	t
1599	ANEXO ESC. TEC. CAP. LAB. MONS. LEONARDO GALLARDO	700067001	199	PRESIDENTE SARMIENTO	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1600	ESCUELA SECUNDARIA PRESIDENTE SARMIENTO	700082600	199	PRESIDENTE SARMIENTO	SECUNDARIO	SEGUNDA	PUBLICO	t
1601	J.I.N.Z. Nº 50  ESC PRESIDENTE SARMIENTO ANEXO	700113504	199	PRESIDENTE SARMIENTO	INICIAL	PRIMERA	PUBLICO	t
1602	PROVINCIA DE MISIONES	700012100	200	PROVINCIA DE MISIONES	PRIMARIO	TERCERA	PUBLICO	t
1603	J.I.N.Z. Nº 49  ESC PROVINCIA DE MISIONES ANEXO	700113404	200	PROVINCIA DE MISIONES	INICIAL	SEGUNDA	PUBLICO	t
1604	ROSARIO VERA PENALOZA	700046800	201	ROSARIO VERA PENALOZA	PRIMARIO	TERCERA	PUBLICO	t
1605	PROPAA ZONA SUR CAP 02 PATRICIAS MENDOCINAS & BIBLIOTECA SUR	700066103	201	ROSARIO VERA PENALOZA	\N	\N	\N	t
1606	PROPAA ZONA SUR CAP 80	700066125	201	ROSARIO VERA PENALOZA	\N	\N	\N	t
1607	C.E.N.S. MEDANO DE ORO	700109600	201	ROSARIO VERA PENALOZA	CENS	TERCERA	PUBLICO	t
1608	J.I.N.Z. Nº 49  ESC ROSARIO VERA PENALOZA SEDE	700113400	201	ROSARIO VERA PENALOZA	INICIAL	SEGUNDA	PUBLICO	t
1609	WALT DISNEY	700046600	202	WALT DISNEY	PRIMARIO	TERCERA	PUBLICO	t
1610	J.I.N.Z. Nº 50  ESC WALT DISNEY ANEXO	700113502	202	WALT DISNEY	INICIAL	PRIMERA	PUBLICO	t
1611	HECTOR CONTE GRAND	700047000	203	HECTOR CONTE GRAND	PRIMARIO	TERCERA	PUBLICO	t
1612	J.I.N.Z. Nº 49  ESC HECTOR CONTE GRAND ANEXO	700113401	203	HECTOR CONTE GRAND	INICIAL	SEGUNDA	PUBLICO	t
1613	ESCUELA E.E.E. DRA. CAROLINA TOBAR GARCIA	700005000	204	E.E.E. DRA. CAROLINA TOBAR GARCIA	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
1614	ANEXO NOCTURNA ANGEL SALVADOR MARTIN	700001801	205	DR. NICANOR LARRAIN	UEPA	TERCERA	PUBLICO	t
1615	DR. NICANOR LARRAIN	700037400	205	DR. NICANOR LARRAIN	PRIMARIO	PRIMERA	PUBLICO	t
1616	ESCUELA SECUNDARIA DR. NICANOR LARRAIN	700099800	205	DR. NICANOR LARRAIN	SECUNDARIO	TERCERA	PUBLICO	t
1617	J.I.N.Z. Nº 52  ESC DR NICANOR LARRAIN ANEXO	700113702	205	DR. NICANOR LARRAIN	INICIAL	CUARTA	PUBLICO	t
1618	MERCEDES SAN MARTIN DE BALCARCE	700032300	206	DOMINGO FAUSTINO SARMIENTO	PRIMARIO	PRIMERA	PUBLICO	t
1619	DOMINGO FAUSTINO SARMIENTO	700032400	206	DOMINGO FAUSTINO SARMIENTO	PRIMARIO	PRIMERA	PUBLICO	t
1620	E.N.I. Nº 12 TELTANTI YU	700032500	206	DOMINGO FAUSTINO SARMIENTO	INICIAL	PRIMERA	PUBLICO	t
1621	NOCTURNA ING. DOMINGO KRAUSE	700032600	206	DOMINGO FAUSTINO SARMIENTO	UEPA	TERCERA	PUBLICO	t
1622	ESCUELA TEC. CAP. LAB. INGENIERO DOMINGO KRAUSE	700070500	199	PRESIDENTE SARMIENTO	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1623	PROVINCIA DEL CHACO	700047100	207	PROVINCIA DEL CHACO	PRIMARIO	PRIMERA	PUBLICO	t
1624	J.I.N.Z. Nº 51 ESC PROVINCIA DEL CHACO SEDE	700113600	207	PROVINCIA DEL CHACO	INICIAL	PRIMERA	PUBLICO	t
1625	E.N.I. Nº 8 QUINOA	700017300	208	PROVINCIA DE CATAMARCA	INICIAL	PRIMERA	PUBLICO	t
1626	COLEGIO SECUNDARIO DR. DIEGO DE SALINAS	700017400	208	PROVINCIA DE CATAMARCA	SECUNDARIO	PRIMERA	PUBLICO	t
1627	PROVINCIA DE CATAMARCA	700052300	208	PROVINCIA DE CATAMARCA	PRIMARIO	PRIMERA	PUBLICO	t
1628	MALVINAS ARGENTINAS	700052500	208	PROVINCIA DE CATAMARCA	PRIMARIO	SEGUNDA	PUBLICO	t
1629	PROVINCIA DE TUCUMAN	700015500	209	PROVINCIA DE TUCUMAN	PRIMARIO	PRIMERA	PUBLICO	t
1630	C.E.N.S. RIVADAVIA	700065500	209	PROVINCIA DE TUCUMAN	CENS	TERCERA	PUBLICO	t
1631	ANEXO ESC. TEC. CAP. LAB. PABLO A. PIZZURNO	700067801	209	PROVINCIA DE TUCUMAN	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1632	ESCUELA DE SECUNDARIA PROVINCIA DE TUCUMAN	700088800	209	PROVINCIA DE TUCUMAN	SECUNDARIO	TERCERA	PUBLICO	t
1633	J.I.N.Z. Nº 43 ESC PROVINCIA DE TUCUMAN ANEXO	700099601	209	PROVINCIA DE TUCUMAN	INICIAL	PRIMERA	PUBLICO	t
1634	TIMOTEO MARADONA	700028000	210	TIMOTEO MARADONA	PRIMARIO	PRIMERA	PUBLICO	t
1635	J.I.N.Z. Nº 43 ESC TIMOTEO MARADONA ANEXO	700099603	210	TIMOTEO MARADONA	INICIAL	PRIMERA	PUBLICO	t
1636	NOCTURNA MATIAS ZAVALLA ANEXO	700027201	210	TIMOTEO MARADONA	UEPA	TERCERA	PUBLICO	t
1637	C.E.N.S. RIM 22	700063800	210	TIMOTEO MARADONA	CENS	TERCERA	PUBLICO	t
1638	E.N.I. Nº 13 JORGE MARIO BERGOGLIO	700049800	211	COL. PROVINCIAL Bº  PARQUE RIVADAVIA NORTE	INICIAL	PRIMERA	PUBLICO	t
1639	B° PARQUE RIVADAVIA NORTE	700050200	211	COL. PROVINCIAL Bº  PARQUE RIVADAVIA NORTE	PRIMARIO	PRIMERA	PUBLICO	t
1640	ESCUELA E. E. JOSE DE CUPERTINO (EX E.E.E. MULTIPLE DE RIVADAVIA)	700058500	211	COL. PROVINCIAL Bº  PARQUE RIVADAVIA NORTE	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
1641	ESCUELA TEC. CAP. LAB. MONS. JOSE AMERICO ORZALI	700069400	211	COL. PROVINCIAL Bº  PARQUE RIVADAVIA NORTE	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1642	COLEGIO SECUNDARIO Bº PARQUE RIVADAVIA NORTE	700075800	211	COL. PROVINCIAL Bº  PARQUE RIVADAVIA NORTE	SECUNDARIO	PRIMERA	PUBLICO	t
1643	PROVINCIA DE SALTA	700015400	212	PROVINCIA DE SALTA	PRIMARIO	PRIMERA	PUBLICO	t
1644	E.N.I. Nº 6	700050000	212	PROVINCIA DE SALTA	INICIAL	PRIMERA	PUBLICO	t
1645	NOCTURNA PRIMERA JUNTA	700000600	228	PROVINCIA DE NEUQUEN	UEPA	TERCERA	PUBLICO	t
1646	COLEGIO SECUNDARIO PROVINCIAL DE RIVADAVIA	700050100	212	PROVINCIA DE SALTA	SECUNDARIO	SEGUNDA	PUBLICO	t
1647	ANEXO SOLDADOS DE MALVINAS	700016201	213	INDEPENDENCIA ARGENTINA	UEPA	TERCERA	PUBLICO	t
1648	INDEPENDENCIA ARGENTINA	700028300	213	INDEPENDENCIA ARGENTINA	PRIMARIO	PRIMERA	PUBLICO	t
1649	ANEXO ESC. TEC. CAP. LAB. EJERCITO ARGENTINO	700068001	213	INDEPENDENCIA ARGENTINA	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1650	J.I.N.Z. Nº 44 ESC INDEPENDENCIA ARGENTINA ANEXO	700099701	213	INDEPENDENCIA ARGENTINA	INICIAL	PRIMERA	PUBLICO	t
1651	C.E.N.S. SOLDADOS DE MALVINAS	700109900	213	INDEPENDENCIA ARGENTINA	CENS	TERCERA	PUBLICO	t
1653	ESCUELA BARRIO HUAZIHUL	700049900	214	CORNELIO SAAVEDRA	PRIMARIO	SEGUNDA	PUBLICO	t
1654	J.I.N.Z. Nº 44 ESC  CORNELIO SAAVEDRA TM ANEXO	700099702	214	CORNELIO SAAVEDRA	INICIAL	PRIMERA	PUBLICO	t
1655	J.I.N.Z. Nº 44 ESC  CORNELIO SAAVEDRA TT ANEXO	700099703	214	CORNELIO SAAVEDRA	INICIAL	PRIMERA	PUBLICO	t
1656	DOCENTES SANJUANINOS	700052800	215	DOCENTES SANJUANINOS	PRIMARIO	PRIMERA	PUBLICO	t
1657	J.I.N.Z. Nº 43 ESC DOCENTES SANJUANINOS ANEXO	700099602	215	DOCENTES SANJUANINOS	INICIAL	PRIMERA	PUBLICO	t
1658	GRAL. MARINO BARTOLOME CARRERAS	700050700	216	MARINO B. CARRERAS	PRIMARIO	PRIMERA	PUBLICO	t
1659	GENDARME ARGENTINO	700058600	216	MARINO B. CARRERAS	PRIMARIO	SEGUNDA	PUBLICO	t
1660	POLICIA DE LA PROVINCIA DE SAN JUAN	700052900	217	POLICIA DE LA PROVINCIA DE SAN JUAN	PRIMARIO	PRIMERA	PUBLICO	t
1661	J.I.N.Z. Nº 43 ESC POLICIA DE LA PROVINCIA DE SAN JUAN SEDE	700099600	217	POLICIA DE LA PROVINCIA DE SAN JUAN	INICIAL	PRIMERA	PUBLICO	t
1662	NOCTURNA ING PEDRO PASCUAL RAMIREZ	700017200	218	PROVINCIA DE MENDOZA	UEPA	TERCERA	PUBLICO	t
1663	PROVINCIA DE MENDOZA	700052400	218	PROVINCIA DE MENDOZA	PRIMARIO	PRIMERA	PUBLICO	t
1664	SAN JUAN DE LA FRONTERA	700052600	218	PROVINCIA DE MENDOZA	PRIMARIO	PRIMERA	PUBLICO	t
1665	ESCUELA TEC. CAP. LAB. INFANTERIA ARGENTINA	700072500	218	PROVINCIA DE MENDOZA	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1666	JUAN JOSE CASTELLI  TURNO MANANA	700028600	219	JUAN JOSE CASTELLI	PRIMARIO	PRIMERA	PUBLICO	t
1667	ESCUELA TEC. CAP. LAB. DR. AUDINO RODRIGUEZ Y OLMOS	700073400	219	JUAN JOSE CASTELLI	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1668	ESCUELA DE NIVEL PRIMARIO BANDERA CIUDADANA	700081300	219	JUAN JOSE CASTELLI	PRIMARIO	PRIMERA	PUBLICO	t
1669	J.I.N.Z. Nº 36 ESC JUAN JOSE CASTELL T M ANEXO	700103402	219	JUAN JOSE CASTELLI	INICIAL	CUARTA	PUBLICO	t
1670	J.I.N.Z. Nº 36 ESC ESC JUAN JOSE CASTELLI T T ANEXO	700103403	219	JUAN JOSE CASTELLI	INICIAL	PRIMERA	PUBLICO	t
1671	ANEXO DIOGENES PERRAMON	700053101	220	ANEXO DIOGENES PERRAMON	PRIMARIO	PRIMERA	PUBLICO	t
1672	J.I.N.Z. Nº 36 ESC DIOGENES PERRAMON ANEXO	700103401	220	ESTRELLA DE SAN JUAN	INICIAL	PRIMERA	PUBLICO	t
1673	PEDRO DE MARQUEZ	700012300	221	PEDRO DE MARQUEZ	PRIMARIO	PRIMERA	PUBLICO	t
1674	ESCUELA DE COMERCIO NICOLAS ECHEZARRETA	700047400	221	PEDRO DE MARQUEZ	SECUNDARIO	PRIMERA	PUBLICO	t
1675	J.I.N.Z. Nº 37 ESC PEDRO DE MARQUEZ ANEXO	700103301	221	PEDRO DE MARQUEZ	INICIAL	TERCERA	PUBLICO	t
1676	NOCTURNA PEDRO ECHAGUE	700017700	222	JULIA LEON	UEPA	TERCERA	PUBLICO	t
1677	JULIA LEON	700053000	222	JULIA LEON	PRIMARIO	PRIMERA	PUBLICO	t
1678	ESCUELA TEC. CAP. LAB. PABLO PIZZURNO	700067800	222	JULIA LEON	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1679	ESCUELA DE EDUCACION SECUNDARIA JULIA LEON	700084300	222	JULIA LEON	SECUNDARIO	SEGUNDA	PUBLICO	t
1680	E.N.I. Nº 22 PROF. MARGARITA MUGNOS DE ESCUDERO	700085600	222	JULIA LEON	INICIAL	PRIMERA	PUBLICO	t
1681	GRAL. INGENIERO ENRIQUE MOSCONI	700001500	223	GRAL. INGENIERO ENRIQUE MOSCONI	PRIMARIO	PRIMERA	PUBLICO	t
1682	E.N.I. Nº 62 LA HIGUERITA DEL JARDIN	700099900	223	GRAL. INGENIERO ENRIQUE MOSCONI	INICIAL	PRIMERA	PUBLICO	t
1683	ANEXO NOCTURNA ALMIRANTE G. BROWN	700002001	224	CRISTOBAL COLON	UEPA	TERCERA	PUBLICO	t
1684	CRISTOBAL COLON	700017600	224	CRISTOBAL COLON	PRIMARIO	TERCERA	PUBLICO	t
1685	PROPAA ZONA SUR CAP N° 79 & UNION VECINAL VILLA NACUSI	700066124	224	CRISTOBAL COLON	\N	\N	\N	t
1686	ESCUELA TEC. CAP. LAB. MONS. LEONARDO GALLARDO	700067000	224	CRISTOBAL COLON	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1687	J.I.N.Z. Nº 50 ESCUELA CRISTOBAL COLON ANEXO	700113503	224	CRISTOBAL COLON	INICIAL	PRIMERA	PUBLICO	t
1688	ALEJANDRO MARIA DE AGUADO	700043200	225	ALEJANDRO MARIA DE AGUADO	PRIMARIO	PRIMERA	PUBLICO	t
1689	ESCUELA TeCNICA DE CAPACITACIoN LABORAL “MADRE TERESA DE CALCUTA (EX  T.C.L Nº 18)	700075200	225	ALEJANDRO MARIA DE AGUADO	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1690	C.E.N.S. SAN MARTIN	700080900	225	ALEJANDRO MARIA DE AGUADO	CENS	TERCERA	PUBLICO	t
1691	ESCUELA SECUNDARIA ALEJANDRO MARIA DE AGUADO	700086200	225	ALEJANDRO MARIA DE AGUADO	SECUNDARIO	PRIMERA	PUBLICO	t
1692	E.N.I. Nº 48 PORTAL PIE DE PALO	700091600	225	ALEJANDRO MARIA DE AGUADO	INICIAL	SEGUNDA	PUBLICO	t
1693	COMBATE DE SAN LORENZO - EMER	700043300	226	COMBATE DE SAN LORENZO  EMER	PRIMARIO	TERCERA	PUBLICO	t
1694	J.I.N.Z. Nº 15 ESC COMBATE DE SAN LORENZO ANEXO	700102803	226	COMBATE DE SAN LORENZO  EMER	INICIAL	SEGUNDA	PUBLICO	t
1695	AUTONOMIA CIUDAD DE BAILEN	700042600	227	AUTONOMIA CIUDAD DE BAILEN	PRIMARIO	TERCERA	PUBLICO	t
1696	PROPAA  ZONA ESTE UNIDAD EDUCATIVA N° 77	700066317	227	AUTONOMIA CIUDAD DE BAILEN	\N	\N	\N	t
1697	J.I.N.Z. Nº 12 ESC AUTONOMIA CIUDAD DE BAILEN SEDE	700103700	227	AUTONOMIA CIUDAD DE BAILEN	INICIAL	SEGUNDA	PUBLICO	t
1698	PROVINCIA DE NEUQUEN	700043400	228	PROVINCIA DE NEUQUEN	PRIMARIO	PRIMERA	PUBLICO	t
1699	PROFESOR JULIO GUTIERREZ	700092300	228	PROVINCIA DE NEUQUEN	SECUNDARIO	TERCERA	PUBLICO	t
1700	J.I.N.Z. Nº 35 PROVINCIA DE NEUQUEN  ANEXO	700098201	228	PROVINCIA DE NEUQUEN	INICIAL	TERCERA	PUBLICO	t
1701	DOMINGUITO	700042700	229	DOMINGUITO	PRIMARIO	TERCERA	PUBLICO	t
1702	ANEXO ESC. TEC. CAP. LAB. MARIA CONTI DE TINTO	700071201	229	DOMINGUITO	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1703	J.I.N.Z. Nº 12 ESC DOMINGUITO ANEXO	700103701	229	DOMINGUITO	INICIAL	SEGUNDA	PUBLICO	t
1704	ESCUELA NOCTURNA CEFERINO NAMUNCURA	700115100	229	DOMINGUITO	UEPA	TERCERA	PUBLICO	t
1705	HORACIO MANN	700010300	230	HORACIO MANN	PRIMARIO	TERCERA	PUBLICO	t
1706	J.I.N.Z. Nº 12 ESC HORACIO MANN ANEXO	700103702	230	HORACIO MANN	INICIAL	SEGUNDA	PUBLICO	t
1707	E.E.E CRUCERO A.R.A. GENERAL BELGRANO	700043500	231	E.E.E. MULTIPLE CRUCERO ARA GRAL. BELGRANO	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
1708	ANTONIO PULENTA	700043600	232	ANTONIO PULENTA	PRIMARIO	TERCERA	PUBLICO	t
1709	J.I.N.Z. Nº 15 ESC ANTONIO PULENTA ANEXO	700102801	232	ANTONIO PULENTA	INICIAL	SEGUNDA	PUBLICO	t
1710	JUAN LARREA - EMER	700043700	233	JUAN LARREA  EMER	PRIMARIO	PRIMERA	PUBLICO	t
1711	ESCUELA DE FORMACIoN PROFESIONAL “MIGUEL ANTONIO LEoN”	700067100	233	JUAN LARREA  EMER	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1712	ESCUELA SECUNDARIA JUAN LARREA	700097800	233	JUAN LARREA  EMER	SECUNDARIO	TERCERA	PUBLICO	t
1713	J.I.N.Z. Nº 15 ESC JUAN LARREA SEDE	700102800	233	JUAN LARREA  EMER	INICIAL	SEGUNDA	PUBLICO	t
1714	INSTITUTO SUPERIOR TECNICO DE SAN MARTIN ANEXO	700112501	233	JUAN LARREA  EMER	SUPERIOR	CUARTA	PUBLICO	t
1715	REPUBLICA DEL PERU	700043800	234	REPUBLICA DEL PERU	PRIMARIO	TERCERA	PUBLICO	t
1716	J.I.N.Z. Nº 35 REPUBLICA DEL PERU SEDE	700098200	234	REPUBLICA DEL PERU	INICIAL	PRIMERA	PUBLICO	t
1717	ERNESTINA ECHEGARAY DE ANDINO	700043000	235	ERNESTINA ECHEGARAY DE ANDINO	PRIMARIO	PRIMERA	PUBLICO	t
1718	ESCUELA TEC. CAP. LAB. MARIA CONTI DE TINTO	700071200	235	ERNESTINA ECHEGARAY DE ANDINO	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1719	J.I.N.Z. Nº 12 ESC ERNESTINA ECHEGARAY DE ANDINO ANEXO	700103703	235	ERNESTINA ECHEGARAY DE ANDINO	INICIAL	SEGUNDA	PUBLICO	t
1720	JULIO VERNE	700043100	236	JULIO VERNE	PRIMARIO	TERCERA	PUBLICO	t
1721	J.I.N.Z. Nº 35 JULIO VERNE  ANEXO	700098202	236	JULIO VERNE	INICIAL	SEGUNDA	PUBLICO	t
1722	E.N.I. Nº 7 AYAC YANEN	700003500	237	CARLOS PELLEGRINI	INICIAL	PRIMERA	PUBLICO	t
1723	NOCTURNA ING. LUIS ANGEL NOUSSAN	700006200	237	CARLOS PELLEGRINI	UEPA	TERCERA	PUBLICO	t
1724	ARISTOBULO GARCIA	700034800	237	CARLOS PELLEGRINI	PRIMARIO	PRIMERA	PUBLICO	t
1725	DR. CARLOS PELLEGRINI	700038600	237	CARLOS PELLEGRINI	PRIMARIO	PRIMERA	PUBLICO	t
1726	ESCUELA TEC. CAP. LAB. DOMINGO MATHEU	700066800	237	CARLOS PELLEGRINI	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1727	JUAN DOLORES GODOY	700000800	238	JUAN DOLORES GODOY	PRIMARIO	SEGUNDA	PUBLICO	t
1728	COLEGIO SECUNDARIO JUAN PABLO ECHAGUE	700026300	238	JUAN DOLORES GODOY	SECUNDARIO	PRIMERA	PUBLICO	t
1729	E.N.I. Nº 82 ALAS DE GRULLA	700116600	238	JUAN DOLORES GODOY	INICIAL	TERCERA	PUBLICO	t
1730	MARIANO NECOCHEA	700000200	239	MARIANO NECOCHEA	PRIMARIO	PRIMERA	PUBLICO	t
1731	NOCTURNA TOMAS ALVA EDISON	700000300	239	MARIANO NECOCHEA	UEPA	TERCERA	PUBLICO	t
1732	SANTIAGO PAREDES	700025700	239	MARIANO NECOCHEA	PRIMARIO	PRIMERA	PUBLICO	t
1733	ESCUELA TEC. CAP. LAB. TOMAS ALVA EDISON	700072400	239	MARIANO NECOCHEA	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1734	E.N.I. Nº 70	700105100	239	MARIANO NECOCHEA	INICIAL	PRIMERA	PUBLICO	t
1735	INSTITUTO SUPERIOR DE EDUCACION FISICA DE SAN JUAN	700026200	240	INST. SUPERIOR DE EDUCACION FISICA DE SAN JUAN	SUPERIOR	PRIMERA	PUBLICO	t
1736	PROVINCIA DE CORRIENTES	700034900	241	PROVINCIA DE CORRIENTES	PRIMARIO	PRIMERA	PUBLICO	t
1737	E.P.E.T. N° 8  SAN JUAN	700073600	241	PROVINCIA DE CORRIENTES	TECNICO	SEGUNDA	PUBLICO	t
1738	J.I.N.Z. Nº 39 PROVINCIA DE CORRIENTES SEDE	700098900	241	PROVINCIA DE CORRIENTES	INICIAL	PRIMERA	PUBLICO	t
1739	FRANCISCO DE VILLAGRA	700000700	242	FRANCISCO DE VILLAGRA	PRIMARIO	SEGUNDA	PUBLICO	t
1740	J.I.N.Z. Nº 39 FRANCISCO DE VILLAGRA ANEXO	700098902	242	FRANCISCO DE VILLAGRA	INICIAL	PRIMERA	PUBLICO	t
1741	JOSE PEDRO CORTINEZ	700038700	243	JOSE PEDRO CORTINEZ	PRIMARIO	PRIMERA	PUBLICO	t
1742	J.I.N.Z. Nº 39 JOSE PEDRO CORTINEZ ANEXO	700098901	243	JOSE PEDRO CORTINEZ	INICIAL	PRIMERA	PUBLICO	t
1743	ESCUELA SECUNDARIA JOSE PEDRO CORTINEZ	700108100	243	JOSE PEDRO CORTINEZ	SECUNDARIO	TERCERA	PUBLICO	t
1744	MIGUEL DE CERVANTES SAAVEDRA	700026100	244	MIGUEL DE CERVANTES SAAVEDRA	PRIMARIO	SEGUNDA	PUBLICO	t
1745	J.I.N.Z. Nº 38 MIGUEL DE CERVANTES SAAVEDRA ANEXO	700098802	244	MIGUEL DE CERVANTES SAAVEDRA	INICIAL	PRIMERA	PUBLICO	t
1746	NOCTURNA MARIA ELISA RUFINO LEON	700000100	245	ANTONIA VILLASCUSA	UEPA	TERCERA	PUBLICO	t
1747	ANTONIA VILLASCUSA	700025500	245	ANTONIA VILLASCUSA	PRIMARIO	PRIMERA	PUBLICO	t
1748	ESCUELA TEC. CAP. LAB. JUAN RAMIREZ DE VELAZCO	700071300	245	ANTONIA VILLASCUSA	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1749	ABENHAMAR RODRIGO	700077600	245	ANTONIA VILLASCUSA	PRIMARIO	PRIMERA	PUBLICO	t
1750	E.N.I. Nº 59 PROFESOR EDGARDO MENDOZA	700099200	245	ANTONIA VILLASCUSA	INICIAL	PRIMERA	PUBLICO	t
1751	DR. AMABLE JONES	700025600	246	DR. AMABLE JONES	PRIMARIO	PRIMERA	PUBLICO	t
1752	C.E.N.S. N° 174	700025900	246	DR. AMABLE JONES	CENS	TERCERA	PUBLICO	t
1753	E.N.I. Nº 79	700115300	246	DR. AMABLE JONES	INICIAL	TERCERA	PUBLICO	t
1754	GRAL. ANTONIO GONZALEZ BALCARCE	700041300	247	GRAL. ANTONIO GONZALEZ BALCARCE	PRIMARIO	PRIMERA	PUBLICO	t
1755	PROPAA ZONA ESTE UNIDAD EDUCATIVA RADIO 2	700066300	247	GRAL. ANTONIO GONZALEZ BALCARCE	PROPAA	TERCERA	PUBLICO	t
1756	ESCUELA TEC. CAP. LAB. MADRES SANJUANINAS	700072300	247	GRAL. ANTONIO GONZALEZ BALCARCE	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1757	ESCUELA DE SECUNDARIA GRAL. ANTONIO GONZALEZ BALCARCE	700092500	247	GRAL. ANTONIO GONZALEZ BALCARCE	SECUNDARIO	TERCERA	PUBLICO	t
1758	E.N.I. Nº 64	700101700	247	GRAL. ANTONIO GONZALEZ BALCARCE	INICIAL	SEGUNDA	PUBLICO	t
1759	JUAN ANTOLIN ZAPATA	700000400	248	JUAN ANTOLIN ZAPATA	PRIMARIO	TERCERA	PUBLICO	t
1760	J.I.N.Z. Nº 38 JUAN ANTOLIN ZAPATA ANEXO	700098801	248	JUAN ANTOLIN ZAPATA	INICIAL	PRIMERA	PUBLICO	t
1761	DR. ALBERT EINSTEIN	700008500	249	ALBERT EINSTEIN	PRIMARIO	TERCERA	PUBLICO	t
1762	J.I.N.Z. Nº 5 ESC ALBERT EINSTEIN SEDE	700102100	249	ALBERT EINSTEIN	INICIAL	PRIMERA	PUBLICO	t
1763	PROFESOR ALEJANDRO MATHUS	700008400	250	PROFESOR ALEJANDRO MATHUS	PRIMARIO	TERCERA	PUBLICO	t
1764	ESCUELA TEC. CAP. LAB. TEODOVINA GIMENEZ	700071800	250	PROFESOR ALEJANDRO MATHUS	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1765	J.I.N.Z. Nº 5 ESC PROFESOR ALEJANDRO MATHUS ANEXO	700102102	250	PROFESOR ALEJANDRO MATHUS	INICIAL	SEGUNDA	PUBLICO	t
1766	CARLOS GUIDO SPANO	700013700	251	CARLOS GUIDO SPANO	PRIMARIO	TERCERA	PUBLICO	t
1767	J.I.N.Z. Nº 10 ESC CARLOS GUIDO SPANO ANEXO	700104002	251	CARLOS GUIDO SPANO	INICIAL	PRIMERA	PUBLICO	t
1768	CONSTANCIO C. VIGIL	700013800	252	CONSTANCIO C. VIGIL	PRIMARIO	TERCERA	PUBLICO	t
1769	J.I.N.Z. Nº 10 ESC CONSTANCIO C. VIGIL ANEXO	700104004	252	CONSTANCIO C. VIGIL	INICIAL	PRIMERA	PUBLICO	t
1770	ESCUELA SECUNDARIA DR. RAMoN EDUARDO LUEJE ( EX C. C. VIGIL	700117000	252	CONSTANCIO C. VIGIL	SECUNDARIO	TERCERA	PUBLICO	t
1771	DR. ANACLETO GIL - EMER	700048100	253	DR. ANACLETO GIL EMER	PRIMARIO	TERCERA	PUBLICO	t
1772	J.I.N.Z. Nº 1 ESC DR. ANACLETO GIL ANEXO	700094102	253	DR. ANACLETO GIL EMER	INICIAL	PRIMERA	PUBLICO	t
1773	PAULO VI	700048300	254	PAULO VI	PRIMARIO	TERCERA	PUBLICO	t
1774	J.I.N.Z. Nº 10 ESC PAULO VI ANEXO	700104003	254	PAULO VI	INICIAL	PRIMERA	PUBLICO	t
1775	MARIANO MORENO - EMER	700013000	255	MARIANO MORENO EMER	PRIMARIO	TERCERA	PUBLICO	t
1835	BENITO LINCH	700053600	280	BENITO LINCH	PRIMARIO	TERCERA	PUBLICO	t
1776	J.I.N.Z. Nº 1 ESC MARIANO MORENO ANEXO	700094105	255	MARIANO MORENO EMER	INICIAL	PRIMERA	PUBLICO	t
1777	COMANDANTE LUIS PIEDRABUENA - EMER	700013900	256	COMANDANTE LUIS PIEDRA BUENA  EMER	PRIMARIO	TERCERA	PUBLICO	t
1778	J.I.N.Z. Nº 10 ESC COMANDANTE LUIS PIEDRABUENA ANEXO	700104005	256	COMANDANTE LUIS PIEDRA BUENA EMER	INICIAL	PRIMERA	PUBLICO	t
1779	20 DE JUNIO	700048400	257	20 DE JUNIO	PRIMARIO	SEGUNDA	PUBLICO	t
1780	J.I.N.Z. Nº 1 ESC 20 DE JUNIO ANEXO	700094103	257	20 DE JUNIO	INICIAL	PRIMERA	PUBLICO	t
1781	JUAN EUGENIO SERU - EMER	700048500	258	JUAN EUGENIO SERU EMER	PRIMARIO	SEGUNDA	PUBLICO	t
1782	PROPAA ZONA SUR UNIDAD EDUCATIVA N° 16	700066132	258	JUAN EUGENIO SERU EMER	PROPAA	TERCERA	PUBLICO	t
1783	N° 21 DR. LEOPOLDO BRAVO	700070700	258	JUAN EUGENIO SERU EMER	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1784	SECUNDARIA JUAN EUGENIO SERU	700082800	258	JUAN EUGENIO SERU EMER	SECUNDARIO	SEGUNDA	PUBLICO	t
1785	J.I.N.Z. Nº 1 ESC JUAN EUGENIO SERU SEDE	700094104	258	JUAN EUGENIO SERU EMER	INICIAL	PRIMERA	PUBLICO	t
1786	JOSE LOMBARDO RADICE	700039100	259	JOSE LOMBARDO RADICE	PRIMARIO	TERCERA	PUBLICO	t
1787	ESCUELA EXPERIMENTAL DE NIVEL MEDIO DIVISADERO	700039200	259	JOSE LOMBARDO RADICE	SECUNDARIO	SEGUNDA	PUBLICO	t
1788	J.I.N.Z. Nº 5 ESC JOSE LOMBARDO RADICE ANEXO	700102103	259	JOSE LOMBARDO RADICE	INICIAL	SEGUNDA	PUBLICO	t
1789	OLEGARIO VICTOR ANDRADE	700008300	260	OLEGARIO VICTOR ANDRADE	PRIMARIO	TERCERA	PUBLICO	t
1790	J.I.N.Z. Nº 5 ESC OLEGARIO VICTOR ANDRADE ANEXO	700102104	260	OLEGARIO VICTOR ANDRADE	INICIAL	SEGUNDA	PUBLICO	t
1791	DOMINGO FRENCH	700014000	261	ALBERGUE DOMINGO FRENCH	ALBERGUE	SEGUNDA	PUBLICO	t
1792	J.I.N.Z. Nº 11 ESC ALBERGUE DOMINGO FRENCH ANEXO	700103903	261	ALBERGUE DOMINGO FRENCH	INICIAL	SEGUNDA	PUBLICO	t
1793	ESCUELA SECUNDARIA DOMINGO FRENCH	700112300	261	ALBERGUE DOMINGO FRENCH	SECUNDARIO	TERCERA	PUBLICO	t
1794	PRESIDENTE MANUEL QUINTANA	700014100	262	PRESIDENTE QUINTANA	PRIMARIO	TERCERA	PUBLICO	t
1795	J.I.N.Z. Nº 11 ESC PRESIDENTE MANUEL QUINTANA ANEXO	700103902	262	PRESIDENTE QUINTANA	INICIAL	SEGUNDA	PUBLICO	t
1796	E.N.I. Nº 5  PATRICIA SARLE	700011600	263	E.N.I. Nº 5  PATRICIA SARLE	INICIAL	PRIMERA	PUBLICO	t
1797	NOCTURNA MINERO SANJUANINO	700008700	264	FALUCHO	UEPA	TERCERA	PUBLICO	t
1798	FALUCHO TURNO MANANA	700039000	264	FALUCHO	PRIMARIO	PRIMERA	PUBLICO	t
1799	C.E.N.S. HEROES DE MALVINAS - ANEXO LOS BERROS	700063701	264	FALUCHO	CENS	TERCERA	PUBLICO	t
1800	ANEXO ESC. TEC. CAP. LAB. TEODOVINA GIMENEZ	700071801	264	FALUCHO	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1801	FALUCHO TURNO TARDE	700106900	264	FALUCHO	PRIMARIO	PRIMERA	PUBLICO	t
1802	E.N.I. Nº 25 GABRIEL GARCIA MARQUEZ	700085400	264	FALUCHO	INICIAL	PRIMERA	PUBLICO	t
1803	ESCUELA DE EDUCACION ESPECIAL CURA BROCHERO (EX E.E.E. MULTIPLE DE SARMIENTO)	700013100	265	E.E.E. MULTIPLE SARMIENTO	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
1804	E.N.I. Nº 14 ALFONSINA STORNI	700013200	266	ESC. NIVEL INICIAL N° 14 ALFONSINA STORNI	INICIAL	PRIMERA	PUBLICO	t
1805	DR. CARLOS DONCEL - EMER	700014300	267	DR. CARLOS DONCEL EMER	PRIMARIO	TERCERA	PUBLICO	t
1806	J.I.N.Z. Nº 10 ESC DR CARLOS DONCEL ANEXO	700104001	267	DR. CARLOS DONCEL EMER	INICIAL	PRIMERA	PUBLICO	t
1807	INGENIERO FELIX AGUILAR	700048600	268	INGENIERO FELIX AGUILAR	PRIMARIO	PRIMERA	PUBLICO	t
1808	PERIODISTA LUIS JORGE BATES	700048700	268	INGENIERO FELIX AGUILAR	PRIMARIO	PRIMERA	PUBLICO	t
1809	C.E.N.S. HeROES DE MALVINAS	700063700	268	INGENIERO FELIX AGUILAR	CENS	TERCERA	PUBLICO	t
1810	ESCUELA SECUNDARIA VICTORINA LENOIR DE NAVARRO	700048800	269	ESCUELA SECUNDARIA VICTORINA LENOIR DE NAVARRO	SECUNDARIO	PRIMERA	PUBLICO	t
1811	PROPPA ZONA SUR CAP 66 CIC VILLA MEDIA AGUA	700066114	269	ESCUELA SECUNDARIA VICTORINA LENOIR DE NAVARRO	\N	\N	\N	t
1812	ESCUELA TEC. CAP. LAB. AUGUSTO BELIN SARMIENTO	700067600	269	ESCUELA SECUNDARIA VICTORINA LENOIR DE NAVARRO	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1813	AGROTECNICA SARMIENTO	700013600	270	AGROTECNICA SARMIENTO	AGROTECNICA	PRIMERA	PUBLICO	t
1814	BATALLA DE SUIPACHA	700008200	271	BATALLA DE SUIPACHA	PRIMARIO	TERCERA	PUBLICO	t
1815	JUAN JOSE LARREA	700014400	272	JUAN JOSE LARREA	PRIMARIO	TERCERA	PUBLICO	t
1816	J.I.N.Z. Nº 11 ESC JUAN JOSE LARREA ANEXO	700103901	272	JUAN JOSE LARREA	INICIAL	SEGUNDA	PUBLICO	t
1817	JOSE MARIA DEL CARRIL	700014500	273	JOSE MARIA DEL CARRIL	PRIMARIO	SEGUNDA	PUBLICO	t
1818	J.I.N.Z. Nº 10 ESC JOSE MARIA DEL CARRIL SEDE	700104000	273	JOSE MARIA DEL CARRIL	INICIAL	PRIMERA	PUBLICO	t
1819	ESCUELA SECUNDARIA JOSE MARIA DEL CARRIL	700110300	273	JOSE MARIA DEL CARRIL	SECUNDARIO	TERCERA	PUBLICO	t
1820	C.E.N.S. ULLUM	700028800	274	ELVIRA DE LA RIESTRA DE LAINEZ	CENS	TERCERA	PUBLICO	t
1821	ESCUELA NOCTURNA DR. RODOLFO EDGAR BRUSOTTI (UEPA Nº 20)	700029000	274	ELVIRA DE LA RIESTRA DE LAINEZ	UEPA	TERCERA	PUBLICO	t
1822	ELVIRA DE LA RIESTRA DE LAINEZ	700029200	274	ELVIRA DE LA RIESTRA DE LAINEZ	PRIMARIO	PRIMERA	PUBLICO	t
1823	INSTITUTO SUPERIOR TECNICO DE ULLUM	700076100	274	ELVIRA DE LA RIESTRA DE LAINEZ	SUPERIOR	TERCERA	PUBLICO	t
1824	E.N.I. Nº 43 MAFALDA	700093900	274	ELVIRA DE LA RIESTRA DE LAINEZ	INICIAL	PRIMERA	PUBLICO	t
1825	E.P.E.T. Nº 9 DR. RENE FAVALORO	700028900	275	E.P.E.T. N°9 DR. RENE FAVALORO	TECNICO	PRIMERA	PUBLICO	t
1826	ESCUELA TEC. CAP. LAB. ARMANDO GAVIORNO	700071000	275	E.P.E.T. N°9 DR. RENE FAVALORO  EX BACHIL. TEC.  U	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1827	ANEXO ESCUELA NOCTURNA DR. RODOLFO EDGAR BRUSOTTI (UEPA Nº 20)	700029001	276	BENJAMIN LENOIR	UEPA	TERCERA	PUBLICO	t
1828	BENJAMIN LENOIR	700029100	276	BENJAMIN LENOIR	PRIMARIO	TERCERA	PUBLICO	t
1829	MARIA ELENA VIDART DE MAURIN	700054400	277	MARIA ELENA VIDART DE MAURIN	PRIMARIO	TERCERA	PUBLICO	t
1830	J.I.N.Z. Nº 56 MARIA ELENA VIDART DE MAURIN ANEXO	700114504	277	MARIA ELENA VIDART DE MAURIN	INICIAL	TERCERA	PUBLICO	t
1831	BUENAVENTURA COLLADO	700018000	278	ALBERGUE BUENAVENTURA COLLADO	ALBERGUE	TERCERA	PUBLICO	t
1832	J.I.N.Z. Nº 7  ALBERGUE BUENAVENTURA COLLADO ANEXO	700099508	278	ALBERGUE BUENAVENTURA COLLADO	INICIAL	TERCERA	PUBLICO	t
1833	MARCO JUSTINIANO GOMEZ NARVAEZ	700053700	279	MARCO JUSTINIANO GOMEZ NARVAEZ	ALBERGUE	TERCERA	PUBLICO	t
1834	J.I.N.Z. Nº 31  ESC ALBERGUE MARCOS J. GOMEZ NARVAEZ ANEXO	700105705	279	ALBERGUE MARCOS J. GOMEZ NARVAEZ	INICIAL	TERCERA	PUBLICO	t
1836	MISION DE CULTURA RURAL Y DOMESTICA N° 9	700072100	280	BENITO LINCH	MONOTECNICA	PRIMERA	PUBLICO	t
1837	ESCUELA SECUNDARIA ASTICA	700075400	280	BENITO LINCH	SECUNDARIO	TERCERA	PUBLICO	t
1838	E.E.E. MULTIPLE DE VALLE FERTIL ANEXO ASTICA	700079401	280	BENITO LINCH	EDUCACION ESPECIAL	CUARTA	PUBLICO	t
1839	ARMADA ARGENTINA	700054300	281	ARMADA ARGENTINA	PRIMARIO	TERCERA	PUBLICO	t
1840	J.I.N.Z. Nº 31  ESC ARMADA ARGENTINA ANEXO	700105702	281	ARMADA ARGENTINA	INICIAL	TERCERA	PUBLICO	t
1841	FRAY CAYETANO RODRIGUEZ	700053500	282	FRAY CAYETANO RODRIGUEZ	PRIMARIO	TERCERA	PUBLICO	t
1842	J.I.N.Z. Nº 7 ESC FRAY CAYETANO RODRIGUEZ ANEXO	700099501	282	FRAY CAYETANO RODRIGUEZ	INICIAL	SEGUNDA	PUBLICO	t
1843	REPUBLICA DE BRASIL	700018500	283	REPUBLICA DE BRASIL	PRIMARIO	TERCERA	PUBLICO	t
1844	NUCLEO GENDARMERIA NACIONAL AULA N° 4	700054803	283	REPUBLICA DE BRASIL	UEPA	TERCERA	PUBLICO	t
1845	ANEXO ESC. CAP. LAB. PEDRO PABLO QUIROGA	700067901	283	REPUBLICA DE BRASIL	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1846	C.E.N.S. BALDES DE LAS CHILCAS	700110700	283	REPUBLICA DE BRASIL	CENS	TERCERA	PUBLICO	t
1847	J.I.N.Z. Nº 56 REPUBLICA DE BRASIL SEDE	700114500	283	REPUBLICA DE BRASIL	INICIAL	TERCERA	PUBLICO	t
1848	BETHSABE PELLIZA DE ESPINOZA	700054200	284	ESC. BETHSABE PELLIZA DE ESPINOZA	PRIMARIO	TERCERA	PUBLICO	t
1849	J.I.N.Z. Nº 56  BETHSABE PELLIZA DE ESPINOZA ANEXO	700114502	284	ESC. BETHSABE PELLIZA DE ESPINOZA	INICIAL	TERCERA	PUBLICO	t
1850	JOSE IGNACIO FERNANDEZ MARADONA	700018400	285	JOSE IGNACIO FERNANDEZ DE MARADONA	PRIMARIO	TERCERA	PUBLICO	t
1851	J.I.N.Z. Nº 31  ESC JOSE IGNACIO FERNANDEZ DE MARADONA ANEXO	700105703	285	JOSE IGNACIO FERNANDEZ DE MARADONA	INICIAL	TERCERA	PUBLICO	t
1852	PRESBITERO CARLOS HUGO MEDINA SUAREZ	700018300	286	PBRO CARLOS HUGO MEDINA SUAREZ	PRIMARIO	TERCERA	PUBLICO	t
1853	J.I.N.Z. Nº 56 PBRO CARLOS HUGO MEDINA SUAREZ ANEXO	700114506	286	PBRO CARLOS HUGO MEDINA SUAREZ	INICIAL	TERCERA	PUBLICO	t
1854	BALDOMERO FERNANDEZ MORENO	700053400	287	BALDOMERO FERNANDEZ MORENO	PRIMARIO	TERCERA	PUBLICO	t
1855	NUCLEO GENDARMERIA NACIONAL AULA N° 2	700054801	293	AGROTECNICA EJERCITO ARGENTINO	UEPA	TERCERA	PUBLICO	t
1856	NUCLEO GENDARMERIA NACIONAL AULA N° 3	700054802	287	BALDOMERO FERNANDEZ MORENO	UEPA	TERCERA	PUBLICO	t
1857	J.I.N.Z. Nº 7 ESC BALDOMERO FERNANDEZ MORENO ANEXO	700099502	287	BALDOMERO FERNANDEZ MORENO	INICIAL	SEGUNDA	PUBLICO	t
1858	FRANKLIN RAWSON	700018200	288	FRANKLIN RAWSON	PRIMARIO	TERCERA	PUBLICO	t
1859	J.I.N.Z. Nº 31  FRANKLIN RAWSON ANEXO	700105706	288	FRANKLIN RAWSON	INICIAL	TERCERA	PUBLICO	t
1860	SARGENTO CABRAL	700054100	289	SARGENTO CABRAL	PRIMARIO	TERCERA	PUBLICO	t
1861	J.I.N.Z. Nº 56  SARGENTO CABRAL ANEXO	700114501	289	SARGENTO CABRAL	INICIAL	TERCERA	PUBLICO	t
1862	PRESBITERO CAYETANO DE QUIROGA	700054000	290	PRESBITERO CAYETANO DE QUIROGA	PRIMARIO	TERCERA	PUBLICO	t
1863	NUCLEO GENDARMERIA NACIONAL AULA N° 5	700054804	290	PRESBITERO CAYETANO DE QUIROGA	UEPA	TERCERA	PUBLICO	t
1864	ESCUELA SECUNDARIA PRESBITERO CAYETANO DE QUIROGA	700099000	290	PRESBITERO CAYETANO DE QUIROGA	SECUNDARIO	TERCERA	PUBLICO	t
1865	J.I.N.Z. Nº 31 ESC PRESBITERO CAYETANO DE QUIROGA SEDE	700105700	290	PRESBITERO CAYETANO DE QUIROGA	INICIAL	TERCERA	PUBLICO	t
1866	CASA DEL NINO	700041700	291	ALBERGUE CASA DEL NINO	ALBERGUE	PRIMERA	PUBLICO	t
1867	PROVINCIA DE FORMOSA	700054600	292	ESCUELA PROVINCIA DE FORMOSA	PRIMARIO	PRIMERA	PUBLICO	t
1868	NUCLEO GENDARMERIA NACIONAL AULA N° 1	700054800	292	ESCUELA PROVINCIA DE FORMOSA	UEPA	TERCERA	PUBLICO	t
1869	ESCUELA TEC. CAP. LAB. CAP.PEDRO PABLO DE QUIROGA	700067900	292	ESCUELA PROVINCIA DE FORMOSA	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1870	C.E.N.S VALLE FERTIL	700096700	292	ESCUELA PROVINCIA DE FORMOSA	CENS	TERCERA	PUBLICO	t
1871	AGROTECNICA EJERCITO ARGENTINO	700054700	293	AGROTECNICA EJERCITO ARGENTINO	AGROTECNICA	PRIMERA	PUBLICO	t
1872	INSTITUTO SUPERIOR TECNICO DE VALLE FERTIL	700108000	293	AGROTECNICA EJERCITO ARGENTINO	SUPERIOR	TERCERA	PUBLICO	t
1873	DRA. JULIETA LANTERI	700053900	294	DRA. JULIETA LANTERI	PRIMARIO	TERCERA	PUBLICO	t
1874	C.E.N.S. LA MAJADITA	700107600	294	DRA. JULIETA LANTERI	CENS	TERCERA	PUBLICO	t
1875	J.I.N.Z. Nº 56  DRA. JULIETA LANTERI ANEXO	700114503	294	DRA. JULIETA LANTERI	INICIAL	TERCERA	PUBLICO	t
1876	HERNANDO DE MAGALLANES	700053800	295	ALBERGUE HERNANDO DE MAGALLANES	ALBERGUE	TERCERA	PUBLICO	t
1877	J.I.N.Z. Nº 31  ESC ALBERGUE HERNANDO DE MAGALLANES ANEXO	700105701	295	ALBERGUE HERNANDO DE MAGALLANES	INICIAL	TERCERA	PUBLICO	t
1878	RECONQUISTA DE BUENOS AIRES	700018100	296	ALBERGUE RECONQUISTA DE BUENOS AIRES	ALBERGUE	TERCERA	PUBLICO	t
1879	J.I.N.Z. Nº 56  RECONQUISTA DE BUENOS AIRES ANEXO	700114505	296	ALBERGUE RECONQUISTA DE BUENOS AIRES	INICIAL	TERCERA	PUBLICO	t
1880	FRAGATA PRESIDENTE SARMIENTO	700053300	297	FRAGATA PRESIDENTE SARMIENTO	PRIMARIO	TERCERA	PUBLICO	t
1881	J.I.N.Z. Nº 7 ANEXO FRAGATA PRESIDENTE SARMIENTO ANEXO	700099509	297	FRAGATA PRESIDENTE SARMIENTO	INICIAL	SEGUNDA	PUBLICO	t
1882	ESCUELA DE LA PATRIA	700017800	298	ESCUELA DE LA PATRIA	PRIMARIO	TERCERA	PUBLICO	t
1883	J.I.N.Z. Nº 7 ANEXO ESC DE LA PATRIA ANEXO	700099510	298	ESCUELA DE LA PATRIA	INICIAL	SEGUNDA	PUBLICO	t
1884	MARIA CURIE	700023000	299	MARIA CURIE	PRIMARIO	TERCERA	PUBLICO	t
1885	J.I.N.Z. Nº 58  ESC MARIE CURIE ANEXO	700111601	299	MARIA CURIE	INICIAL	TERCERA	PUBLICO	t
1886	COMODORO RIVADAVIA EMER	700023100	300	COMODORO RIVADAVIA EMER	PRIMARIO	TERCERA	PUBLICO	t
1887	ESCUELA SECUNDARIA BARTOLOME DEL BONO ANEXO COMODORO RIVADAVIA	700104902	300	COMODORO RIVADAVIA EMER	\N	\N	\N	t
1888	J.I.N.Z. Nº 58  ESC COMODORO RIVADAVIA ANEXO	700111603	300	COMODORO RIVADAVIA EMER	INICIAL	TERCERA	PUBLICO	t
1889	PEDRO VALENZUELA - EMER	700036200	301	PEDRO VALENZUELA EMER	PRIMARIO	TERCERA	PUBLICO	t
1890	J.I.N.Z. Nº 58  ESC PEDRO VALENZUELA ANEXO	700111602	301	PEDRO VALENZUELA EMER	INICIAL	TERCERA	PUBLICO	t
1891	RAMON BARRERA	700035900	302	RAMON BARRERA	PRIMARIO	TERCERA	PUBLICO	t
1892	J.I.N.Z. Nº 9 ESC RAMON BARRERA ANEXO	700103502	302	RAMON BARRERA	INICIAL	PRIMERA	PUBLICO	t
1893	ESCUELA SECUNDARIA RAMON BARRERA	700108900	302	RAMON BARRERA	SECUNDARIO	TERCERA	PUBLICO	t
1894	DR. JUAN CARLOS NAVARRO	700019400	303	ALBERGUE DR. JUAN CARLOS NAVARRO	ALBERGUE	SEGUNDA	PUBLICO	t
1895	NOCTURNA 25 DE MAYO (EX U.E.P.A.Nº 22)	700019500	303	ALBERGUE DR. JUAN CARLOS NAVARRO	UEPA	TERCERA	PUBLICO	t
1896	ESCUELA TEC. CAP. LAB. JUAN PABLO II	700069700	303	ALBERGUE DR. JUAN CARLOS NAVARRO	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1897	ESCUELA SECUNDARIA DR. JUAN CARLOS NAVARRO	700107000	303	ALBERGUE DR. JUAN CARLOS NAVARRO	SECUNDARIO	TERCERA	PUBLICO	t
1898	J.I.N.Z. Nº 57 ALBERGUE DR. JUAN CARLOS NAVARRO SEDE	700113100	303	ALBERGUE DR. JUAN CARLOS NAVARRO	INICIAL	TERCERA	PUBLICO	t
1899	MISION MONOTECNICA Y DE EXTENSION CULTURAL N° 64	700073300	304	ESC. TEC. CAP. LAB. Nº 5 MARTIN YANZON	MONOTECNICA	PRIMERA	PUBLICO	t
1900	ESC. TEC. CAP. LAB. Nº 5 MARTIN YANZON	700084200	304	ESC. TEC. CAP. LAB. Nº 5 MARTIN YANZON	TEC. CAP. LABORAL	CUARTA	PUBLICO	t
1901	JUAN IGNACIO GORRITI	700019100	305	JUAN IGNACIO GORRITI	PRIMARIO	SEGUNDA	PUBLICO	t
1902	ESCUELA SECUNDARIA JUAN IGNACIO GORRITI	700100100	305	JUAN IGNACIO GORRITI	SECUNDARIO	TERCERA	PUBLICO	t
1903	J.I.N.Z. Nº 57 ESC JUAN IGNACIO GORRITI	700113103	305	JUAN IGNACIO GORRITI	INICIAL	TERCERA	PUBLICO	t
1904	BARTOLOME DEL BONO	700057800	306	BARTOLOME DEL BONO	PRIMARIO	SEGUNDA	PUBLICO	t
1905	ESCUELA TEC. CAP. LAB. N° 11	700070000	306	BARTOLOME DEL BONO	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1906	J.I.N.Z. Nº 4 ESC BARTOLOME DEL BONO ANEXO	700103602	306	BARTOLOME DEL BONO	INICIAL	PRIMERA	PUBLICO	t
1907	ESCUELA SECUNDARIA BARTOLOME DEL BONO	700104900	306	BARTOLOME DEL BONO	SECUNDARIO	TERCERA	PUBLICO	t
1908	PROVINCIA DE SAN LUIS	700019300	307	ALBERGUE PROVINCIA DE SAN LUIS	ALBERGUE	TERCERA	PUBLICO	t
1909	J.I.N.Z. Nº 57 ALBERGUE PROVINCIA DE SAN LUIS	700113102	307	ALBERGUE PROVINCIA DE SAN LUIS	INICIAL	TERCERA	PUBLICO	t
1910	PRILIDIANO PUEYRREDON	700023400	308	PRILIDIANO PUEYRREDON	PRIMARIO	PRIMERA	PUBLICO	t
1911	PROPAA ZONA ESTE UNIDAD EDUCATIVA N° 50	700066306	308	PRILIDIANO PUEYRREDON	PROPAA	TERCERA	PUBLICO	t
1912	E.N.I. Nº 57 SUNYAY	700097200	308	PRILIDIANO PUEYRREDON	INICIAL	SEGUNDA	PUBLICO	t
1913	AULA SATELITE NOCTURNA 25 DE MAYO	701950001	308	PRILIDIANO PUEYRREDON	\N	\N	\N	t
1914	JUANA DE IBARBOUROU	700023500	309	JUANA DE IBARBOUROU	PRIMARIO	TERCERA	PUBLICO	t
1915	J.I.N.Z. Nº 9 ESC JUANA DE IBARBOUROU ANEXO	700103503	309	JUANA DE IBARBOUROU	INICIAL	PRIMERA	PUBLICO	t
1916	MAR ARGENTINO	700057300	310	MAR ARGENTINO	PRIMARIO	TERCERA	PUBLICO	t
1917	ESCUELA SECUNDARIA BARTOLOME DEL BONO ANEXO MAR ARGENTINO	700104903	310	MAR ARGENTINO	\N	\N	\N	t
1918	J.I.N.Z. Nº 58  ESC MAR ARGENTINO ANEXO	700111605	310	MAR ARGENTINO	INICIAL	TERCERA	PUBLICO	t
1919	RAFAEL ALBERTO ARRIETA EMER	700023200	311	RAFAEL ALBERTO ARRIETA EMER	PRIMARIO	TERCERA	PUBLICO	t
1920	ESCUELA SECUNDARIA  BARTOLOME DEL BONO ANEXO RAFAEL ARRIETA	700104901	311	RAFAEL ALBERTO ARRIETA EMER	\N	\N	\N	t
1921	J.I.N.Z. Nº 58  ESC RAFAEL ALBERTO ARRIETA ANEXO	700111604	311	RAFAEL ALBERTO ARRIETA EMER	INICIAL	TERCERA	PUBLICO	t
1922	MARTIN YANZON - EMER	700057400	312	MARTIN YANZON EMER	PRIMARIO	SEGUNDA	PUBLICO	t
1923	ESCUELA SECUNDARIA MARTIN YANZON	700082900	312	MARTIN YANZON EMER	SECUNDARIO	SEGUNDA	PUBLICO	t
1924	J.I.N.Z. Nº 9 ESC MARTIN YANZON ANEXO	700103501	312	MARTIN YANZON EMER	INICIAL	PRIMERA	PUBLICO	t
1925	PASCUAL CHENA	700057500	313	PASCUAL CHENA	PRIMARIO	TERCERA	PUBLICO	t
1926	J.I.N.Z. Nº 9 ESC PASCUAL CHENA ANEXO	700103504	313	PASCUAL CHENA	INICIAL	PRIMERA	PUBLICO	t
1927	ESCUELA SECUNDARIA PASCUAL CHENA	700109300	313	PASCUAL CHENA	SECUNDARIO	TERCERA	PUBLICO	t
1928	PADRE FEDERICO MAGGIO EMER	700019200	314	PADRE FEDERICO MAGGIO EMER	PRIMARIO	TERCERA	PUBLICO	t
1929	J.I.N.Z. Nº 57 - PADRE FEDERICO MAGGIO	700113101	314	PADRE FEDERICO MAGGIO EMER	INICIAL	TERCERA	PUBLICO	t
1930	ESCUELA SECUNDARIA PADRE FEDERICO MAGGIO	700115900	314	PADRE FEDERICO MAGGIO EMER	SECUNDARIO	TERCERA	PUBLICO	t
1931	SEGUNDINO NAVARRO - EMER	700035700	315	SEGUNDINO J. NAVARRO  EMER	PRIMARIO	PRIMERA	PUBLICO	t
1932	TEC. CAP. LAB TEOLINDA ROMERO DE SOTOMAYOR	700072600	315	SEGUNDINO J. NAVARRO  EMER	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1933	ESCUELA SECUNDARIA SEGUNDINO J. NAVARRO	700080400	315	SEGUNDINO J. NAVARRO  EMER	SECUNDARIO	PRIMERA	PUBLICO	t
1934	COMANDANTE TOMAS ESPORA - EMER	700057600	316	COMANDANTE TOMAS ESPORA  EMER	PRIMARIO	TERCERA	PUBLICO	t
1935	ESCUELA DE EDUCACION SECUNDARIA CTE. TOMAS ESPORA	700083300	316	COMANDANTE TOMAS ESPORA  EMER	SECUNDARIO	TERCERA	PUBLICO	t
1936	J.I.N.Z. Nº 58 ESC COMANDANTE TOMAS ESPORA SEDE	700111600	316	COMANDANTE TOMAS ESPORA  EMER	INICIAL	TERCERA	PUBLICO	t
1937	DOMINGO DE ORO	700023600	317	DOMINGO DE ORO	PRIMARIO	PRIMERA	PUBLICO	t
1938	J.I.N.Z. Nº 4 ESC DOMINGO DE ORO ANEXO	700103603	317	DOMINGO DE ORO	INICIAL	PRIMERA	PUBLICO	t
1939	ESCUELA NOCTURNA MAESTRO JUAN REYES LUNA	700004300	318	PROVINCIA DE SAN JUAN	UEPA	TERCERA	PUBLICO	t
1940	PROVINCIA DE SAN JUAN	700036000	318	PROVINCIA DE SAN JUAN	PRIMARIO	PRIMERA	PUBLICO	t
1941	CENS 25 DE MAYO	700094000	318	PROVINCIA DE SAN JUAN	CENS	TERCERA	PUBLICO	t
1942	J.I.N.Z. Nº 9 ESC PROVINCIA DE SAN JUAN SEDE	700103500	318	PROVINCIA DE SAN JUAN	INICIAL	PRIMERA	PUBLICO	t
1943	MERCEDES NIEVA DE CASTRO	700029400	319	MERCEDES NIEVAS DE CASTRO	PRIMARIO	SEGUNDA	PUBLICO	t
1944	ESCUELA NOCTURNA INGENIERO MATIAS SANCHEZ DE LORIA ( UEPA Nº 3)	700046500	319	MERCEDES NIEVAS DE CASTRO	UEPA	TERCERA	PUBLICO	t
1945	ESCUELA SECUNDARIA DE ZONDA	700107200	319	MERCEDES NIEVAS DE CASTRO	SECUNDARIO	TERCERA	PUBLICO	t
1946	E.N.I. Nº 80 CIELO ALTO	700114900	319	MERCEDES NIEVAS DE CASTRO	INICIAL	TERCERA	PUBLICO	t
1947	RAFAEL OBLIGADO	700029600	320	RAFAEL OBLIGADO	PRIMARIO	PRIMERA	PUBLICO	t
1948	PROPAA ZONA OESTE UNIDAD EDUCATIVA N° 55	700066421	320	RAFAEL OBLIGADO	\N	\N	\N	t
1949	ESCUELA TEC. CAP. LAB. JERONIMO LUIS DE CABRERA	700068500	320	RAFAEL OBLIGADO	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
1950	C.E.N.S. ZONDA	700081000	320	RAFAEL OBLIGADO	CENS	TERCERA	PUBLICO	t
1951	E.N.I. Nº 73 SIERRAS AZULES	700107800	320	RAFAEL OBLIGADO	INICIAL	SEGUNDA	PUBLICO	t
1952	DR. ALEJANDRO FLEMING	700040600	321	ALEJANDRO FLEMING  EMER	PRIMARIO	TERCERA	PUBLICO	t
1953	J.I.N.Z. Nº 19 ALEJANDRO FLEMING SEDE	700096300	321	ALEJANDRO FLEMING  EMER	INICIAL	SEGUNDA	PUBLICO	t
1954	JUAN MARTIN DE PUEYRREDON	700051500	322	JUAN MARTIN DE PUEYRREDON	PRIMARIO	TERCERA	PUBLICO	t
2124	GOBERNADOR ELOY CAMUS	700083400	413	GOBERNADOR ELOY CAMUS	PRIMARIO	PRIMERA	PUBLICO	t
1955	J.I.N.Z. Nº 17 ESC JUAN MARTIN DE PUEYRREDON ANEXO	700096103	322	JUAN MARTIN DE PUEYRREDON	INICIAL	TERCERA	PUBLICO	t
1956	MANUEL ALBERTI	700006900	323	MANUEL ALBERTI	PRIMARIO	TERCERA	PUBLICO	t
1957	J.I.N.Z. Nº 6 ESC MANUEL ALBERTI ANEXO	700102002	323	MANUEL ALBERTI	INICIAL	SEGUNDA	PUBLICO	t
1958	JOSEFA RAMIREZ DE GARCIA	700008100	324	ALBERGUE JOSEFA RAMIREZ DE GARCIA	ALBERGUE	SEGUNDA	PUBLICO	t
1959	J.I.N.Z. Nº 5 ESC ALB JOSEFA RAMIREZ DE GARCIA ANEXO	700102101	324	ALBERGUE JOSEFA RAMIREZ DE GARCIA	INICIAL	SEGUNDA	PUBLICO	t
1960	ESCUELA SECUNDARIA JOSEFA RAMIREZ DE GARCIA	700117300	324	ALBERGUE JOSEFA RAMIREZ DE GARCIA	SECUNDARIO	TERCERA	PUBLICO	t
1961	J.I.N.Z. Nº 11 ESC SATURNINO SEGUROLA SEDE	700103900	325	SATURNINO SEGUROLA	INICIAL	SEGUNDA	PUBLICO	t
1962	NOCTURNA POSTA DE YACANTO	700013400	325	SATURNINO SEGUROLA	UEPA	TERCERA	PUBLICO	t
1963	SATURNINO SEGUROLA	700014200	325	SATURNINO SEGUROLA	PRIMARIO	PRIMERA	PUBLICO	t
1964	SAN JOSE DE CALASANZ	700034000	326	SAN JOSE DE CALASANZ	PRIMARIO	TERCERA	PUBLICO	t
1965	J.I.N.Z. Nº 28  ESC SAN JOSE DE CALASANZ ANEXO	700104201	326	SAN JOSE DE CALASANZ	INICIAL	TERCERA	PUBLICO	t
1966	CENTRO DE EDUCACION FISICA N°20	700076700	327	CENTRO DE EDUCACION FISICA N°20	NO FORMAL	PRIMERA	PUBLICO	t
1967	TESINAK	700079400	328	TESINAK EX E.E.E. MULTIPLE DE VALLE FERTIL	EDUCACION ESPECIAL	CUARTA	PUBLICO	t
1968	ANEXO NOCTURNA MARIA ELISA RUFINO LEON	700000101	329	REPUBLICA DE CHILE	UEPA	TERCERA	PUBLICO	t
1969	REPUBLICA DE CHILE	700035200	329	REPUBLICA DE CHILE	PRIMARIO	SEGUNDA	PUBLICO	t
1970	ANEXO ESC. TEC. CAP. LAB. TOMAS ALVA EDISON	700072401	329	REPUBLICA DE CHILE	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1971	C.E.N.S. TOMAS A. EDISON	700097900	329	REPUBLICA DE CHILE	CENS	TERCERA	PUBLICO	t
1972	E.N.I. Nº 61 PEQUEnOS TESOROS	700100700	329	REPUBLICA DE CHILE	INICIAL	TERCERA	PUBLICO	t
1973	ESCUELA SECUNDARIO GRAL.DON TORIBIO DE LUZURIAGA	700002800	330	COLEGIO SECUNDARIO GRAL.TORIBIO DE LUZURIAGA	SECUNDARIO	PRIMERA	PUBLICO	t
1974	ESCUELA TEC. CAP. LAB. SOFIA LENOIR DE KLAPPENBACH	700070900	330	COLEGIO SECUNDARIO GRAL.TORIBIO DE LUZURIAGA	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
1975	POLICIA FEDERAL ARGENTINA	700035600	331	POLICIA FEDERAL ARGENTINA	PRIMARIO	PRIMERA	PUBLICO	t
1976	ANEXO ESC. TEC. CAP. LAB. JUAN RAMIREZ DE VELAZCO	700071301	331	POLICIA FEDERAL ARGENTINA	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
1977	E.N.I. Nº 49 HEBE ALMEIDA DE GARGIULO	700092000	331	POLICIA FEDERAL ARGENTINA	INICIAL	PRIMERA	PUBLICO	t
1978	NOCTURNA JOSE MANUEL ESTRADA	700004400	332	LEONOR SANCHEZ DE ARANCIBIA	UEPA	TERCERA	PUBLICO	t
1979	LEONOR SANCHEZ DE ARANCIBIA	700036500	332	LEONOR SANCHEZ DE ARANCIBIA	PRIMARIO	PRIMERA	PUBLICO	t
1980	E.N.I. Nº 41 DANTE ALBERTO SAAVEDRA	700089400	332	LEONOR SANCHEZ DE ARANCIBIA	INICIAL	PRIMERA	PUBLICO	t
1981	ESCUELA SECUNDARIA LEONOR SANCHEZ DE ARANCIBIA	700091800	332	LEONOR SANCHEZ DE ARANCIBIA	SECUNDARIO	TERCERA	PUBLICO	t
1982	E.N.I. Nº 11 MARTA GIMENEZ PASTOR	700004500	333	CANDELARIA ALBARRACIN DE GODOY	INICIAL	PRIMERA	PUBLICO	t
1983	CANDELARIA ALBARRACIN DE GODOY	700004600	333	CANDELARIA ALBARRACIN DE GODOY	PRIMARIO	PRIMERA	PUBLICO	t
1984	C.E.N.S. CABO SEGUNDO JOSE ESTEBAN LUCERO (CENS 134)	700004800	333	CANDELARIA ALBARRACIN DE GODOY	CENS	PRIMERA	PUBLICO	t
1985	LEOPOLDO CORRETJER	700037200	333	CANDELARIA ALBARRACIN DE GODOY	PRIMARIO	PRIMERA	PUBLICO	t
1986	ALAS ARGENTINAS	700004900	334	ALAS ARGENTINAS	PRIMARIO	PRIMERA	PUBLICO	t
1987	ESCUELA SECUNDARIA ALAS ARGENTINAS	700093800	334	ALAS ARGENTINAS	SECUNDARIO	SEGUNDA	PUBLICO	t
1988	J.I.N.Z. Nº 52  ESC ALAS ARGENTINAS SEDE	700113700	334	ALAS ARGENTINAS	INICIAL	PRIMERA	PUBLICO	t
1989	DR. PABLO ANTONIO RAMELLA	700064300	335	DR. PABLO A. RAMELLA	PRIMARIO	PRIMERA	PUBLICO	t
1990	ESCUELA SECUNDARIA DR. PABLO RAMELLA	700106600	335	DR. PABLO A. RAMELLA	SECUNDARIO	TERCERA	PUBLICO	t
1991	J.I.N.Z. Nº 52  ESC DR. PABLO A. RAMELLA ANEXO	700113703	335	DR. PABLO A. RAMELLA	INICIAL	PRIMERA	PUBLICO	t
1992	CARLOS MARIA DE ALVEAR T.T.	700006300	336	CARLOS MARIA DE ALVEAR	PRIMARIO	PRIMERA	PUBLICO	t
1993	CARLOS MARIA DE ALVEAR T.M.	700024900	336	CARLOS MARIA DE ALVEAR	PRIMARIO	PRIMERA	PUBLICO	t
1994	NOCTURNA DR. CARLOS MARIA BIEDMA	700064100	336	CARLOS MARIA DE ALVEAR	UEPA	TERCERA	PUBLICO	t
1995	PASO DE LOS ANDES	700007300	337	ALBERGUE PASO DE LOS ANDES	ALBERGUE	TERCERA	PUBLICO	t
1996	PRESIDENTE MITRE	700008000	338	PRESIDENTE MITRE	PRIMARIO	SEGUNDA	PUBLICO	t
1997	J.I.N.Z. Nº 8 ESC PRESIDENTE MITRE SEDE	700102600	338	PRESIDENTE MITRE	INICIAL	SEGUNDA	PUBLICO	t
1998	ANEXO CACIQUE PISMANTA	700008001	339	ANEXO CACIQUE PISMANTA	PRIMARIO	SEGUNDA	PUBLICO	t
1999	J.I.N.Z. Nº 8 ESC CACIQUE PISMANTA ANEXO	700102601	339	ANEXO CACIQUE PISMANTA	INICIAL	SEGUNDA	PUBLICO	t
2000	E.N.I. Nº  3 JULIETA SARMIENTO	700010100	340	E.N.I. Nº  3 JULIETA SARMIENTO	INICIAL	PRIMERA	PUBLICO	t
2001	NOCTURNA ROQUE SAENZ PENA	700012400	341	ROQUE SAENZ PENA	UEPA	TERCERA	PUBLICO	t
2002	ESCUELA ROQUE SAENZ PENA	700012500	341	ROQUE SAENZ PENA	PRIMARIO	PRIMERA	PUBLICO	t
2003	ESCUELA TEC. CAP. LAB. EJERCITO ARGENTINO	700068000	341	ROQUE SAENZ PENA	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
2004	J.I.N.Z. Nº 37 ESC ROQUE SAENZ PENA SEDE	700103300	341	ROQUE SAENZ PENA	INICIAL	TERCERA	PUBLICO	t
2005	GOBERNADOR FEDERICO CANTONI	700015700	342	GOBERNADOR FEDERICO CANTONI	PRIMARIO	PRIMERA	PUBLICO	t
2006	PRESIDENTE AVELLANEDA	700016100	342	GOBERNADOR FEDERICO CANTONI	PRIMARIO	PRIMERA	PUBLICO	t
2007	NOCTURNA JUAN DE DIOS JOFRE	700016400	342	GOBERNADOR FEDERICO CANTONI	UEPA	TERCERA	PUBLICO	t
2008	ESCUELA TEC. CAP. LAB. AGUSTIN DELGADO	700068800	342	GOBERNADOR FEDERICO CANTONI	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
2009	E.N.I. Nº 44 ESTRELLITA DE LOS COLORES	700090400	342	GOBERNADOR FEDERICO CANTONI	INICIAL	PRIMERA	PUBLICO	t
2010	ESCUELA SECUNDARIA PRESIDENTE AVELLANEDA	700107500	342	GOBERNADOR FEDERICO CANTONI	SECUNDARIO	TERCERA	PUBLICO	t
2011	COLEGIO SUPERIOR N° 1 FUERZA AEREA ARGENTINA	700017900	343	COLEGIO SUPERIOR Nº 1 FUERZA AEREA ARGENTINA	SECUNDARIO	PRIMERA	PUBLICO	t
2012	COLEGIO SUPERIOR N° 1 FUERZA AEREA ARGENTINA	700017900	343	COLEGIO SUPERIOR Nº 1 FUERZA AEREA ARGENTINA	SUPERIOR	PRIMERA	PUBLICO	t
2013	DRA. FRANCISCA RIOS DE PAEZ	700020300	344	DRA. FRANCISCA RIOS DE PAEZ	PRIMARIO	TERCERA	PUBLICO	t
2014	J.I.N.Z. Nº 1 ESC DRA. FRANCISCA RIOS DE PAEZ ANEXO	700094100	344	DRA. FRANCISCA RIOS DE PAEZ	INICIAL	PRIMERA	PUBLICO	t
2015	ESCUELA SECUNDARIA DRA. FRANCISCA RIOS DE PAEZ	700109500	344	DRA. FRANCISCA RIOS DE PAEZ	SECUNDARIO	TERCERA	PUBLICO	t
2016	COLEGIO SECUNDARIO DE BARREAL	700022300	345	COLEGIO SECUNDARIO DE BARREAL	SECUNDARIO	SEGUNDA	PUBLICO	t
2017	BERNARDO DE MONTEAGUDO	700023800	346	ERNESTO A. BAVIO	PRIMARIO	PRIMERA	PUBLICO	t
2018	C.E.N.T. N° 18 ANEXO	700030501	346	ERNESTO A. BAVIO	SUPERIOR	CUARTA	PUBLICO	t
2019	NOCTURNA ERNESTO A. BAVIO	700059100	346	ERNESTO A. BAVIO	UEPA	TERCERA	PUBLICO	t
2020	ERNESTO A. BAVIO	700059200	346	ERNESTO A. BAVIO	PRIMARIO	PRIMERA	PUBLICO	t
2021	ESCUELA TEC. CAP. LAB. LEOPOLDO LUGONES	700069200	346	ERNESTO A. BAVIO	TEC. CAP. LABORAL	PRIMERA	PUBLICO	t
2022	JORGE WASHINGTON	700034100	347	JORGE WASHINGTON	PRIMARIO	PRIMERA	PUBLICO	t
2023	ESCUELA SECUNDARIA JORGE WASHINGTON	700081200	347	JORGE WASHINGTON	SECUNDARIO	PRIMERA	PUBLICO	t
2024	J.I.N.Z. Nº 29  ESC JORGE WASHINGTON ANEXO	700103102	347	JORGE WASHINGTON	INICIAL	PRIMERA	PUBLICO	t
2025	E.N.I. Nº 9 SARA CHAMBERLAIN ECCLESTON	700033500	348	E.N.I. Nº 9 SARA CHAMBERLAIN ECCLESTON	INICIAL	PRIMERA	PUBLICO	t
2026	JOSE MANUEL ESTRADA	700037000	349	ALBERGUE JOSE MANUEL ESTRADA	ALBERGUE	PRIMERA	PUBLICO	t
2027	ESCUELA E.E.E. BILINGUE PARA SORDOS	700074800	349	ALBERGUE JOSE MANUEL ESTRADA	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
2028	J.I.N.Z. Nº 52  ESC ALBERGUE JOSE MANUEL ESTRADA ANEXO	700113701	349	ALBERGUE JOSE MANUEL ESTRADA	INICIAL	PRIMERA	PUBLICO	t
2029	PROVINCIA DEL CHUBUT	700045000	350	PROVINCIA DEL CHUBUT	PRIMARIO	SEGUNDA	PUBLICO	t
2030	J.I.N.Z. Nº 3  ESC PROVINCIA DE CHUBUT SEDE	700094300	350	PROVINCIA DEL CHUBUT	INICIAL	PRIMERA	PUBLICO	t
2031	E.N.I. Nº 4 MARTHA SALOTTI	700042100	351	ESCUELA NIVEL INICIAL N° 4 MARTHA ALCIRA SALOTTI	INICIAL	PRIMERA	PUBLICO	t
2032	PRESBITERO PATRICIO LOPEZ DEL CAMPO	700051300	352	PRESBITERO P. LOPEZ DEL CAMPO	PRIMARIO	TERCERA	PUBLICO	t
2033	J.I.N.Z. Nº 18 ESC ESTEBAN AGUSTIN GASCON ANEXO	700096202	353	ESTEBAN AGUSTIN GASCON	INICIAL	TERCERA	PUBLICO	t
2034	C.E.N.S. NIQUIVIL	700111100	353	ESTEBAN AGUSTIN GASCON	CENS	TERCERA	PUBLICO	t
2035	ESTEBAN AGUSTIN GASCON	700051700	353	ESTEBAN AGUSTIN GASCON	PRIMARIO	TERCERA	PUBLICO	t
2036	DIOGENES PERRAMON MATRIZ	700053100	354	DIOGENES PERRAMON MATRIZ	PRIMARIO	PRIMERA	PUBLICO	t
2037	J.I.N.Z. Nº 36 SEDE ESC DIOGENES PERRAMON SEDE	700103400	354	DIOGENES PERRAMON MATRIZ	INICIAL	PRIMERA	PUBLICO	t
2038	SUBOFICIAL MAYOR SEGUNDO ANTENOR YUBEL	700055700	355	SUBOFICIAL MAYOR SEGUNDO ATENOR YUBEL	PRIMARIO	TERCERA	PUBLICO	t
2039	J.I.N.Z. Nº 53  ESC SUBOFICIAL MAYOR SEGUNDO ATENOR YUBEL ANEXO	700108302	355	SUBOFICIAL MAYOR SEGUNDO ATENOR YUBEL	INICIAL	PRIMERA	PUBLICO	t
2040	VIRGINIA MORENO DE PARKES	700056000	356	VIRGINIA MORENO DE PARKES	PRIMARIO	TERCERA	PUBLICO	t
2041	J.I.N.Z. Nº 26  ESC VIRGINIA MORENO DE PARKES ANEXO	700104403	356	VIRGINIA MORENO DE PARKES	INICIAL	PRIMERA	PUBLICO	t
2042	ESCUELA DOMICILIARIA Y HOSPITALARIA DR. GUILLERMO RAWSON - ANEXO DR. MARCIAL QUIROGA - DETERMINAR AREA	700060301	357	E.E.E. DR GUILLERMO RAWSON (ANEXO MARCIAL QUIROGA	EDUCACION HOSPITALARIA	PRIMERA	PUBLICO	t
2043	REGIMIENTO DE PATRICIOS	700063100	358	REGIMIENTO DE PATRICIOS	PRIMARIO	PRIMERA	PUBLICO	t
2044	J.I.N.Z. Nº 34 REGIMIENTO DE PATRICIOS  ANEXO	700097403	358	REGIMIENTO DE PATRICIOS	INICIAL	PRIMERA	PUBLICO	t
2045	ESCUELA SECUNDARIA REGIMIENTO DE PATRICIOS	700106100	358	REGIMIENTO DE PATRICIOS	SECUNDARIO	TERCERA	PUBLICO	t
2046	ESCUELA E.E.E. MULTIPLE DE ULLUM	700064500	360	ESCUELA E.E. MULTIPLE DE ULLUM	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
2047	E.E.E. FELIPA ROJAS	700065000	361	E.E.E. FELIPA ROJAS (EX. MULTIPLE DE IGLESIA)	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
2048	AUTONOMIA BARTOLOME DEL BONO	700065700	362	AUTONOMIA BARTOLOME DEL BONO	PRIMARIO	TERCERA	PUBLICO	t
2049	J.I.N.Z. Nº 4  ESC AUTONOMIA BARTOLOME DEL BONO ANEXO	700103604	362	AUTONOMIA BARTOLOME DEL BONO	INICIAL	PRIMERA	PUBLICO	t
2050	ESCUELA SECUNDARIA  BARTOLOME DEL BONO ANEXO AUTONOMIA BARTOLOME DEL BONO	700104904	362	AUTONOMIA BARTOLOME DEL BONO	SECUNDARIO	TERCERA	PUBLICO	t
2051	COLEGIO PROVINCIAL DE SANTA LUCIA PROFESORA OLGA AUBONE	700025800	363	COLEGIO PROVINCIAL DE SANTA LUCIA	SECUNDARIO	PRIMERA	PUBLICO	t
2052	E.E.E. Y FORMACION LABORAL ALFREDO FORTABAT	700065200	364	E.E.E. Y FORMACION LABORAL ALFREDO FORTABAT	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
2053	ESCUELA DE EDUCACION INTEGRAL PARA ADOLESCENTES Y JOVENES CON DISCAPACIDAD PROF. IVONNE BARUD DE QUATTROPANI	700104700	364	E.E.E. Y FORMACION LABORAL ALFREDO FORTABAT	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
2054	PASO DE VALLE HERMOSO	700081900	365	PASO DE VALLE HERMOSO	PRIMARIO	TERCERA	PUBLICO	t
2055	J.I.N.Z. Nº 47 ESC PASO DE VALLE HERMOSO ANEXO	700102202	365	PASO DE VALLE HERMOSO	INICIAL	SEGUNDA	PUBLICO	t
2056	ESCUELA Bº FRANKLIN RAWSON	700082300	366	ESCUELA Bº FRANKLIN RAWSON	PRIMARIO	PRIMERA	PUBLICO	t
2057	E.N.I. Nº 23 PROF. MARGARITA FERRA DE BARTOL	700086400	366	ESCUELA Bº FRANKLIN RAWSON	INICIAL	SEGUNDA	PUBLICO	t
2058	ANEXO ESC. TEC. CAP. LAB. GREGORIA DE SAN MARTIN NOCTURNA	700066602	367	ANEXO ESC.TEC.CAP.LAB. GREGORIA M.DE SAN MARTIN (N	TEC. CAP. LABORAL	SEGUNDA	PUBLICO	t
2059	CENTRO DE FORMACION PROFESIONAL N°1 DE RAWSON	700069800	368	CENTRO DE FORMACION PROFESIONAL N°1 DE RAWSON	FOR. PROF. EDUC. NO FORMAL	PRIMERA	PUBLICO	t
2060	CTRO. FORMACION PROF. Nº1 RAWSON ANEXO CONCEPCION	700069801	369	CTRO. FORMACION PROF. Nº1 RAWSON ANEXO CONCEPCION	FOR. PROF. EDUC. NO FORMAL	TERCERA	PUBLICO	t
2061	E.P.E.T. N° 7 BARRIO ARAMBURU	700075000	370	E.P.E.T. Nº 7	TECNICO	SEGUNDA	PUBLICO	t
2062	ESCUELA TECNICA OBRERO ARGENTINO ETOA	700062600	371	ESC. TECNICA OBRERO ARGENTINO	TECNICO	PRIMERA	PUBLICO	t
2063	EGB 3 Y POLIMODAL GRAL. SAN MARTIN	700031000	372	COLEGIO DE EDUC.GRAL.BASICA 3 Y POLIMODAL GRAL. SA	SECUNDARIO	PRIMERA	PUBLICO	t
2064	MISION MONOTECNICA Y DE EXTENSION CULTURAL N° 59	700070200	373	MISION MONOTECNICA Y DE EXTENSION CULTURAL N° 59	MONOTECNICA	PRIMERA	PUBLICO	t
2065	TERESA DE ASENCIO (EX E.E.E. MuLTIPLE DE ANGACO)	700081600	374	E.E.E. MULTIPLE DE ANGACO	EDUCACION ESPECIAL	TERCERA	PUBLICO	t
2066	ESCUELA AMeRICA SOFiA GIL DE CALVO ANEXO ( EX U.E.P.A. MOVIL N° 2)	700009101	90	JOSE MARIA DE LOS RIOS	UEPA	TERCERA	PUBLICO	t
2067	J.I.N.Z. Nº 19 ESC PRESBITERO P. LOPEZ DEL CAMPO ANEXO	700096302	352	PRESBITERO P. LOPEZ DEL CAMPO	INICIAL	SEGUNDA	PUBLICO	t
2068	P ZONA NORTE UNIDAD EDUCATIVA N° 49	700066226	364	E.E.E. Y FORMACION LABORAL ALFREDO FORTABAT	\N	\N	\N	t
2069	PRESIDENTE NESTOR CARLOS KIRCHNER	700084100	375	PRESIDENTE NESTOR KIRCHNER	SECUNDARIO	SEGUNDA	PUBLICO	t
2070	MISION MONOTECNICA Y DE EXTENSION CULTURAL N° 44	700069600	376	ESCUELA MISION MONOTECNICA Nº 44	MONOTECNICA	CUARTA	PUBLICO	t
2071	ESCUELA SECUNDARIA JUAN MANTOVANI	700100200	377	ESCUELA SECUNDARIA JUAN MANTOVANI	SECUNDARIO	PRIMERA	PUBLICO	t
2072	EEE ANEXO JUANA GODOY DE BRANDES	700015602	378	EEE ANEXO JUANA GODOY DE BRANDES	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
2073	E.N.I. Nº 38 LA NUSTA	700087700	379	E.N.I. Nº 38 LA NUSTA	INICIAL	PRIMERA	PUBLICO	t
2074	ESCUELA SECUNDARIO CACIQUE ANGACO	700049400	380	COLEGIO SECUNDARIO CACIQUE ANGACO	SECUNDARIO	PRIMERA	PUBLICO	t
2075	INSTITUTO SUPERIOR DE FORMACION TECNICA DE ANGACO	700114600	380	COLEGIO SECUNDARIO CACIQUE ANGACO	SUPERIOR	CUARTA	PUBLICO	t
2076	MARY MANN	700014700	381	MARY MANN	PRIMARIO	TERCERA	PUBLICO	t
2077	J.I.N.Z. Nº 14 ESC MARY MANN ANEXO	700103802	381	MARY MANN	INICIAL	SEGUNDA	PUBLICO	t
2078	J.I.N.Z. Nº 14 ESC PROF VICTOR MERCANTE ANEXO	700103803	382	PROFESOR VICTOR MERCANTE	INICIAL	SEGUNDA	PUBLICO	t
2079	JOSE ALEJANDRO SEGOVIA - EMER	700015200	383	JOSE ALEJANDRO SEGOVIA  EMER	PRIMARIO	TERCERA	PUBLICO	t
2080	J.I.N.Z. Nº 13 ESC JOSE ALEJANDRO SEGOVIA ANEXO	700102701	383	JOSE ALEJANDRO SEGOVIA  EMER	INICIAL	SEGUNDA	PUBLICO	t
2081	ESCUELA E.E.E. MULTIPLE CALINGASTA	700056900	384	ESCUELA E.E.E. MULTIPLE CALINGASTA	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
2082	ESCUELA TECNICA GRAL. MANUEL SAVIO	700032100	385	ESC. TEC. GRAL. MANUEL SAVIO	TECNICO	TERCERA	PUBLICO	t
2083	ESCUELA Bº FRONDIZI	700089900	386	ESCUELA Bº FRONDIZI	PRIMARIO	SEGUNDA	PUBLICO	t
2084	E.N.I. Nº 47 SAN JOSE GABRIEL DEL ROSARIO BROCHERO	700090000	386	ESCUELA Bº FRONDIZI	INICIAL	PRIMERA	PUBLICO	t
2085	ESCUELA SECUNDARIA Bº FRONDIZI	700091200	386	ESCUELA Bº FRONDIZI	SECUNDARIO	TERCERA	PUBLICO	t
2086	PROFESORADO ENS. SUP. MONSENOR SILVINO MARTINEZ	700044100	387	CENTRO DE FORMACION DOCENTE	SUPERIOR	PRIMERA	PUBLICO	t
2087	INSTITUTO DE ENSENANZA SUP. DRA. CARMEN PENALOZA	700044200	387	CENTRO DE FORMACION DOCENTE	SUPERIOR	SEGUNDA	PUBLICO	t
2088	EDUCACION PRIMARIA LOS MANANTIALES	700089000	389	EDUCACION PRIMARIA LOS MANANTIALES	PRIMARIO	TERCERA	PUBLICO	t
2089	C.E.N.S. CAUCETE	700096800	389	LOS MANTANTIALES	CENS	TERCERA	PUBLICO	t
2090	REPUBLICA ARGENTINA ANEXO CASAS VIEJAS	700021702	390	REPUBLICA ARGENTINA ANEXO CASAS VIEJAS	PRIMARIO	TERCERA	PUBLICO	t
2091	J.I.N.Z. Nº 54 REPUBLICA ARGENTINA CASAS VIEJAS ANEXO	700111402	390	REPUBLICA ARGENTINA ANEXO CASAS VIEJAS	INICIAL	SEGUNDA	PUBLICO	t
2092	ESCUELA DE COMERCIO ALFONSINA STORNI	700039900	391	ESCUELA DE COMERCIO ALFONSINA STORNI	SECUNDARIO	PRIMERA	PUBLICO	t
2093	E.N.I. Nº 29 PAPA FRANCISCO	700088400	392	ESCUELA DE NIVEL INICIAL N° 29	INICIAL	PRIMERA	PUBLICO	t
2094	ESCUELA SECUNDARIA PROFESORA ISABEL GIRONES	700100900	393	ESCUELA SECUNDARIA PROFESORA ISABEL GIRONES	SECUNDARIO	PRIMERA	PUBLICO	t
2095	ESCUELA SECUNDARIA GOBERNADOR FEDERICO CANTONI	700106200	342	ESCUELA SECUNDARIA GOBERNADOR FEDERICO CANTONI	SECUNDARIO	TERCERA	PUBLICO	t
2096	ESCUELA SECUNDARIA PROF. MARCELO YACANTE	700107300	394	ESCUELA SECUNDARIA PROF. MARCELO YACANTE	SECUNDARIO	TERCERA	PUBLICO	t
2097	ESCUELA SECUNDARIA LICENCIADO EDGARDO MENDOZA	700028100	395	BACHILLERATO JOSE MANUEL DE ESTRADA	SECUNDARIO	SEGUNDA	PUBLICO	t
2098	COLEGIO SECUNDARIO JORGE LUIS BORGUES	700059300	396	COLEGIO SECUNDARIO JORGE LUIS BORGES	SECUNDARIO	PRIMERA	PUBLICO	t
2099	ESCUELA DE EDUCACIoN ESPECIAL “MARTINA CHAPANAY”	700058900	397	EDUCACION ESPECIAL MARTINA CHAPANAY	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
2100	PROPAA ZONA NORTE UNIDAD EDUCATIVA N° 32 Y NEFROLOGIA HOSPITAL RAWSON	700066212	397	EEE MARTINA CHAMPANAY	\N	\N	\N	t
2101	ESCUELA SECUNDARIA PROVINCIA DE LA RIOJA	700110400	398	ESCUELA SECUNDARIA PROVINCIA DE LA RIOJA	SECUNDARIO	TERCERA	PUBLICO	t
2102	PIUQUENES	700101600	399	PIUQUENES  (EX E.N.I. Nº 60)	INICIAL	TERCERA	PUBLICO	t
2103	E.N.I. Nº 40 “ADRIANA VEGA”	700088500	400	E.N.I. Nº 40 “ADRIANA VEGA”	INICIAL	PRIMERA	PUBLICO	t
2104	E.N.I. Nº 10 MARIA ELENA WALSH	700059000	401	ESC. DE NIVEL INICIAL N° 10	INICIAL	PRIMERA	PUBLICO	t
2105	COLEGIO SECUNDARIO DR. MANUEL ALVAR LOPEZ	700004000	402	COL. DR. MANUEL ALVAR LOPEZ	SECUNDARIO	PRIMERA	PUBLICO	t
2106	E.N.I. Nº 16 ROSARIO SARMIENTO	700084500	403	E.N.I. Nº 16 ROSARIO SARMIENTO	INICIAL	PRIMERA	PUBLICO	t
2107	ANEXO ESC. TEC. CAP. LAB. ACONCAGUA	700070101	115	ANTARTIDA ARGENTINA	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
2108	E.N.I. Nº 32 CAMINO DEL INCA	700087100	405	PROVINCIA DE SANTA CRUZ	INICIAL	PRIMERA	PUBLICO	t
2109	RODEO	700114300	405	ALBERGUE RODEO	ALBERGUE	TERCERA	PUBLICO	t
2110	ESCUELA TEC. CAP. LAB. ACONCAGUA	700070100	406	ESC.TEC.CAP.LAB. ACONCAGUA	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
2111	ESCUELA NORMAL SUPERIOR FRAY J. S. MARIA DE ORO	700051400	407	ESC. NORM. SUPERIOR FRAY J. S. MARIA DE ORO	INICIAL	PRIMERA	PUBLICO	t
2112	ESCUELA NORMAL SUPERIOR FRAY J. S. MARIA DE ORO	700051400	407	ESC. NORM. SUPERIOR FRAY J. S. MARIA DE ORO	PRIMARIO	PRIMERA	PUBLICO	t
2113	ESCUELA NORMAL SUPERIOR FRAY J. S. MARIA DE ORO	700051400	407	ESC. NORM. SUPERIOR FRAY J. S. MARIA DE ORO	SECUNDARIO	PRIMERA	PUBLICO	t
2114	ESCUELA NORMAL SUPERIOR FRAY J. S. MARIA DE ORO	700051400	407	ESC. NORM. SUPERIOR FRAY J. S. MARIA DE ORO	SUPERIOR	PRIMERA	PUBLICO	t
2115	E.N.I. Nº 37 DR. ANTONIO WASHINGTON CHAVEZ	700087600	408	E.N.I. Nº 37	INICIAL	PRIMERA	PUBLICO	t
2116	NOCTURNA RICARDO BALBIN	700021200	409	E.E.E. JUANA AZURDUY DE PADILLA	UEPA	TERCERA	PUBLICO	t
2117	ESCUELA E.E.E. JUANA AZURDUY DE PADILLA	700021500	409	E.E.E. JUANA AZURDUY DE PADILLA	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
2118	ESCUELA DE EDUCACION ESPECIAL INDIA MARIANA (EX E.E.E. MULTIPLE POCITO)	700020500	410	E.E.E. MULTIPLE POCITO	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
2119	NOCTURNA ING. DOMINGO KRAUSE  5TO CARTEL ANEXO	700032602	172	GRAL. MARTIN MIGUEL DE GUEMES	UEPA	TERCERA	PUBLICO	t
2120	ANEXO NOCTURNA ING. DOMINGO KRAUSE	700032601	172	LAS HORNILLAS	UEPA	TERCERA	PUBLICO	t
2121	PROPAA ZONA SUR CAP N° 61	700066110	412	LAS HORNILLAS	\N	\N	\N	t
2122	LAS HORNILLAS	700083500	412	LAS HORNILLAS	PRIMARIO	PRIMERA	PUBLICO	t
2123	J.I.N.Z. Nº 30  ESC LAS HORNILLAS ANEXO	700103201	412	LAS HORNILLAS	INICIAL	PRIMERA	PUBLICO	t
2125	J.I.N.Z. Nº 30 ESC GOBERNADOR ELOY CAMUS SEDE	700103200	413	GOBERNADOR ELOY CAMUS	INICIAL	PRIMERA	PUBLICO	t
2126	E.N.I. Nº 69 RINCONCITO DE LUZ	700105300	414	ESCUELA SECUNDARIA JOSE RUDECINDO ROJO	INICIAL	PRIMERA	PUBLICO	t
2127	ESCUELA SECUNDARIA JOSE RUDECINDO ROJO	700112800	414	ESCUELA SECUNDARIA JOSE RUDECINDO ROJO	SECUNDARIO	TERCERA	PUBLICO	t
2128	E.N.I. Nº 27 JULIO CORTAZAR	700086800	415	ESCUELA DE NIVEL INICIAL (E.N.I.) Nº 27	INICIAL	PRIMERA	PUBLICO	t
2129	COL. SEC. CAPITAN DE FRAGATA CARLOS MARIA MOYANO	700005300	416	COL. SEC. CAPITAN DE FRAGATA CARLOS MARIA MOYANO	SECUNDARIO	PRIMERA	PUBLICO	t
2130	ESCUELA E.E.E. DR. RAMON PENAFORT	700033300	417	E.E.E. DR. RAMON PENAFORT	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
2131	PROPAA ZONA NORTE UNIDAD EDUCATIVAA N° 13 CLINICA DE LA CUIDAD	700066207	417	EEE DR. RAMON PENAFORT	\N	\N	\N	t
2132	Bº EJERCITO DE LOS ANDES	700097100	418	Bº EJERCITO DE LOS ANDES	PRIMARIO	SEGUNDA	PUBLICO	t
2133	ESCUELA DE EDUCACION SECUNDARIA FRAY LUIS BELTRAN	700099400	418	Bº EJERCITO DE LOS ANDES	SECUNDARIO	TERCERA	PUBLICO	t
2134	J.I.N.Z. Nº 51 ESC Bº EJERCITO DE LOS ANDES ANEXO	700113602	418	Bº EJERCITO DE LOS ANDES	INICIAL	PRIMERA	PUBLICO	t
2135	E.N.I. Nº 68	700105900	419	BARRIO VALLE GRANDE TURNO MANANA	INICIAL	PRIMERA	PUBLICO	t
2136	BARRIO VALLE GRANDE TURNO MANANA	700106300	419	BARRIO VALLE GRANDE TURNO MANANA	PRIMARIO	SEGUNDA	PUBLICO	t
2137	BARRIO VALLE GRANDE TURNO TARDE	700106400	419	BARRIO VALLE GRANDE TURNO MANANA	PRIMARIO	PRIMERA	PUBLICO	t
2138	ESCUELA SECUNDARIA BARRIO VALLE GRANDE	700106500	419	BARRIO VALLE GRANDE TURNO MANANA	SECUNDARIO	SEGUNDA	PUBLICO	t
2139	COLEGIO SECUNDARIO ANTONIO DE LA TORRE	700024600	420	COLEGIO SECUNDARIO ANTORIO DE LA TORRE	SECUNDARIO	PRIMERA	PUBLICO	t
2140	E.N.I. Nº 39 HEBE SAN MARTIN DE DUPRAT	700087900	420	COLEGIO SECUNDARIO ANTORIO DE LA TORRE	INICIAL	PRIMERA	PUBLICO	t
2141	E.N.I. Nº 42 EL JARDIN DE FRANCESCO	700089500	421	E.N.I. Nº 42 EL JARDIN DE FRANCESCO	INICIAL	PRIMERA	PUBLICO	t
2142	COLEGIO SUPERIOR Nº 1 DE RAWSON  PROFESORA IOLE LEBE PALMOLELLI DE MASCOTTI	700030400	422	ESCUELA SUPERIOR Nº 1 DE RAWSON	SECUNDARIO	PRIMERA	PUBLICO	t
2143	COLEGIO SUPERIOR Nº 1 DE RAWSON  PROFESORA IOLE LEBE PALMOLELLI DE MASCOTTI	700030400	422	ESCUELA SUPERIOR Nº 1 DE RAWSON	SUPERIOR	PRIMERA	PUBLICO	t
2144	E.P.E.T. N° 6 LA BEBIDA	700001400	423	E.P.E.T. N° 6 LA BEBIDA	TECNICO	PRIMERA	PUBLICO	t
2145	E.N.I. Nº 30 ELSA BORNEMAN	700086700	424	E.N.I. Nº 30 ELSA BORNEMAN	INICIAL	PRIMERA	PUBLICO	t
2146	ESCUELA SECUNDARIA GRAL DE LA NACION ING. ENRIQUE MOSCONI	700080000	425	GRAL. DE LA NACION INGENIERO ENRIQUE MOSCONI	SECUNDARIO	PRIMERA	PUBLICO	t
2147	CRUCE DE LOS ANDES	700088900	426	ESCUELA CRUCE DE LOS ANDES	PRIMARIO	SEGUNDA	PUBLICO	t
2148	J.I.N.Z. Nº 44 ESC CRUCE DE LOS ANDES SEDE	700099700	426	ESCUELA CRUCE DE LOS ANDES	INICIAL	PRIMERA	PUBLICO	t
2149	ESCUELA SECUNDARIA CRUCE DE LOS ANDES	700110000	426	ESCUELA CRUCE DE LOS ANDES	SECUNDARIO	TERCERA	PUBLICO	t
2150	ANEXO ESCUELA NOCTURNA ROQUE SAENZ PENA	700012401	427	ESCUELA DE EDUCACION PRIMARIA B° NUEVO CUYO	UEPA	TERCERA	PUBLICO	t
2151	NUEVO CUYO TURNO MANANA	700090100	427	ESCUELA DE EDUCACION PRIMARIA B° NUEVO CUYO	PRIMARIO	PRIMERA	PUBLICO	t
2152	E.N.I. Nº 46 PROF. ANTONIA MONCHO DE TRINCADO	700090200	427	ESCUELA DE EDUCACION PRIMARIA B° NUEVO CUYO	INICIAL	PRIMERA	PUBLICO	t
2153	ESCUELA SECUNDARIA BARRIO NUEVO CUYO	700091300	427	ESCUELA DE EDUCACION PRIMARIA B° NUEVO CUYO	SECUNDARIO	PRIMERA	PUBLICO	t
2154	NUEVO CUYO TURNO TARDE	700108200	427	ESCUELA DE EDUCACION PRIMARIA B° NUEVO CUYO	PRIMARIO	PRIMERA	PUBLICO	t
2155	INSTITUTO SUPERIOR TECNICO EN SEGURIDAD PUBLICA	700114400	428	ESCUELA DE CADETES DE POLICiA DOCTOR ANTONINO ABER	SUPERIOR	CUARTA	PUBLICO	t
2156	COLEGIO SECUNDARIO AUGUSTO PULENTA	700042800	429	COLEGIO SECUNDARIO AUGUSTO PULENTA	SECUNDARIO	PRIMERA	PUBLICO	t
2157	INSTITUTO SUPERIOR TECNICO DE SAN MARTIN	700112500	429	COLEGIO SECUNDARIO AUGUSTO PULENTA	SUPERIOR	TERCERA	PUBLICO	t
2158	ESCUELA DE NIVEL SECUNDARIO LOS BERROS	700088600	430	ESCUELA DE EDUCACION SECUNDARIA LOS BERROS	SECUNDARIO	PRIMERA	PUBLICO	t
2159	ENRIQUE LARRETA - EMER	700048200	431	ENRIQUE LARRETA EMER	PRIMARIO	SEGUNDA	PUBLICO	t
2160	ESCUELA SECUNDARIA ENRIQUE LARRETA	700093700	431	ENRIQUE LARRETA EMER	SECUNDARIO	SEGUNDA	PUBLICO	t
2161	J.I.N.Z. Nº 1 ESC ENRIQUE LARRETA ANEXO	700094101	431	ENRIQUE LARRETA EMER	INICIAL	PRIMERA	PUBLICO	t
2162	E.E.E. CRISTO DE LA QUEBRADA (EX E.E.E. MULTIPLE DE LOS BERROS)	700084000	432	E.E.E. MULTIPLE DE LOS BERROS	EDUCACION ESPECIAL	SEGUNDA	PUBLICO	t
2163	VALLE DE TULUM	700000500	433	VALLE DE TULUM	PRIMARIO	TERCERA	PUBLICO	t
2164	J.I.N.Z. Nº 38 VALLE DE TULUM ANEXO	700098804	433	VALLE DE TULUM	INICIAL	PRIMERA	PUBLICO	t
2165	EDUCACION POPULAR	700026000	434	ESCUELA EDUCACION POPULAR	PRIMARIO	SEGUNDA	PUBLICO	t
2166	J.I.N.Z. Nº 38 ESC EDUCACION POPULAR SEDE	700098800	434	ESCUELA EDUCACION POPULAR	INICIAL	PRIMERA	PUBLICO	t
2167	ESCUELA SECUNDARIA EDUCACION POPULAR	700109700	434	ESCUELA EDUCACION POPULAR	SECUNDARIO	TERCERA	PUBLICO	t
2168	ESC. DE EDUCACION ESPECIAL GRACIELA CIBEIRA DE CANTONI (EX. C.A.R.E.M.)	700027300	435	E.E.E. GRACIELA CIBEIRA DE CANTONI	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
2169	ESCUELA DE EDUCACION SECUNDARIA CARLOS PELLEGRINI	700083000	436	CARLOS PELLEGRINI SECUNDARIA	SECUNDARIO	PRIMERA	PUBLICO	t
2170	E.N.I. Nº 81 HUELLITAS DE AMOR	700115000	437	E.N.I. Nº 81 HUELLITAS DE AMOR	INICIAL	TERCERA	PUBLICO	t
2171	FLORENCIA NIGHTINGALE	700057700	438	FLORENCIA NIGHTINGALE	PRIMARIO	PRIMERA	PUBLICO	t
2172	PROPAA ZONA ESTE UNIDAD EDUCATIVA N° 29	700066302	438	FLORENCIA NIGHTINGALE	\N	\N	\N	t
2173	J.I.N.Z. Nº 4 ESC FLORENCIA NIGHTINGALE SEDE	700103600	438	FLORENCIA NIGHTINGALE	INICIAL	PRIMERA	PUBLICO	t
2174	ESCUELA SECUNDARIA FLORENCIA NIGHTINGALE	700109000	438	FLORENCIA NIGHTINGALE	SECUNDARIO	TERCERA	PUBLICO	t
2175	C.E.N.S. LA CHIMBERA	700117100	438	FLORENCIA NIGHTINGALE	CENS	TERCERA	PUBLICO	t
2176	AGROINDUSTRIAL 25 DE MAYO	700057900	439	AGROINDUSTRIAL 25 DE MAYO	AGROTECNICA	PRIMERA	PUBLICO	t
2177	PROPAA ZONA ESTE UNIDAD EDUCATIVA N° 76 25 DE MAYO	700066303	440	ESCUELA DE EDUCACION ESPECIAL 25 DE MAYO	\N	\N	\N	t
2178	ESCUELA DE EDUCACION ESPECIAL MULTIPLE DR. OTONIEL FERNANDEZ(EX E.E.E. MULTIPLE 25 DE MAYO)	700093100	440	ESCUELA DE EDUCACION ESPECIAL 25 DE MAYO	EDUCACION ESPECIAL	TERCERA	PUBLICO	t
2179	E.N.I. Nº 54 SANTA ROSA	700095600	441	ESCUELA DE NIVEL INICIAL (E.N.I.) Nº 54	INICIAL	PRIMERA	PUBLICO	t
2180	E.N.I. Nº 18 PROF. GLADYS NOEMI PERALTA	700085800	442	E.N.I. Nº 18 PROF. GLADYS NOEMI PERALTA	INICIAL	PRIMERA	PUBLICO	t
2181	AGROTECNICA ZONDA	700075100	443	AGROTECNICA DE ZONDA	AGROTECNICA	SEGUNDA	PUBLICO	t
2182	ESCUELA E.E.E. ZONDA	700029500	444	ESCUELA E.E.E. ZONDA	EDUCACION ESPECIAL	TERCERA	PUBLICO	t
2183	ESTRELLA DE SAN JUAN	700188500	220	ANEXO DIOGENES PERRAMON	PRIMARIO	SEGUNDA	PUBLICO	t
2184	ANEXO ESCUELA TEC. CAP. LAB. N° 11	700070001	306	BARTOLOME DEL BONO	\N	\N	\N	t
2185	ANEXO TALLER PROTEGIDO E.E.E ALFREDO FORTABAT	700065201	364	E.E.E. Y FORMACION LABORAL ALFREDO FORTABAT	\N	\N	\N	t
2186	ANEXO UNIDAD EDUCATIVA N° 22 (EX - ETCL JOSE H. GONZALEZ)	700067701	25	SATURNINO ARAOZ	TEC. CAP. LABORAL	TERCERA	PUBLICO	t
2187	AULA SATELITE NOCTURNA 25 DE MAYO	700019501	308	PRILIDIANO PUEYRREDON	UEPA	TERCERA	PUBLICO	t
2188	CENS CORDILLERA DE LOS ANDES	700079900	120	PROVINCIA DE SANTA CRUZ	CENS	TERCERA	PUBLICO	t
2189	CENTRO DE EDUCACIoN AGRICOLA N° 2	700082000	127	AGROTECNICA DR. MANUEL BELGRANO	\N	\N	\N	t
2190	CENTRO DE FORMACION PROFESIONAL DE LA UOCRA	700111000	543	UOCRA	TECNICO	TERCERA	PUBLICO	t
2191	COLEGIO SECUNDARIO NOCTURNO SANTA MARIA	700036800	391	ESCUELA DE COMERCIO ALFONSINA STORNI	SECUNDARIO	PRIMERA	PUBLICO	t
2192	EEE ANEXO JUANA GODOY DE BRANDES	700015601	378	EEE ANEXO JUANA GODOY DE BRANDES	EDUCACION ESPECIAL	PRIMERA	PUBLICO	t
2193	SECUNDARIA CAPITAN DE FRAGATA HIPOLITO BUCHARDO	700118600	144	CAPITAN DE FRAGATA HIPOLITO BUCHARDO	SECUNDARIO	TERCERA	PUBLICO	t
2194	ESCUELA SECUNDARIA COMODORO RIVADAVIA EMER	700118400	300	COMODORO RIVADAVIA EMER	SECUNDARIO	TERCERA	PUBLICO	t
2195	ESCUELA SECUNDARIA MAR ARGENTINO	700118300	310	MAR ARGENTINO	SECUNDARIO	PRIMERA	PUBLICO	t
2196	ESCUELA SECUNDARIA PASCUAL CHENA ANEXO RAFAEL ALBERTO ARRIETA	700109301	311	RAFAEL ALBERTO ARRIETA EMER	SECUNDARIO	TERCERA	PUBLICO	t
2197	INSTITUTO TeCNICO SUPERIOR DE GESTIoN SARMIENTO ANEXO	700075901	259	JOSE LOMBARDO RADICE	SUPERIOR	CUARTA	PUBLICO	t
2198	J.I.N.Z. Nº 7 BENITO LINCH SEDE	700099500	280	BENITO LINCH	INICIAL	SEGUNDA	PUBLICO	t
2199	J.I.N.Z. Nº 30 ESCUELA ESPAnA ANEXO	700103203	177	ESPANA	INICIAL	PRIMERA	PUBLICO	t
2200	J.I.N.Z. Nº 48 AGUSTIN VICTORIO GNECCO ANEXO	700102303	104	GRAL. ESTANISLAO SOLER	INICIAL	TERCERA	PUBLICO	t
2201	J.I.N.Z. Nº 48 GRAL ESTANISLAO SOLER ANEXO	700102302	104	GRAL. ESTANISLAO SOLER	INICIAL	TERCERA	PUBLICO	t
2202	NOCTURNA JUAN B. ALBERD	700024400	49	25 DE MAYO	UEPA	TERCERA	PUBLICO	t
2203	NOCTURNA MONSEnOR RODRIGUEZ Y OLMOS	700028500	219	JUAN JOSE CASTELLI  TURNO MANANA	UEPA	TERCERA	PUBLICO	t
2204	PROFESOR VICTOR MERCANTE	700015000	382	PROFESOR VICTOR MERCANTE	PRIMARIO	TERCERA	PUBLICO	t
2205	PROPAA - ZONA ESTE ANEXO 26	700066326	269	ESCUELA SECUNDARIA VICTORINA LENOIR DE NAVARRO	PROPAA	CUARTA	PUBLICO	t
2206	PROPPA - ZONA ESTE ANEXO 5	700066305	91	ANDINA	PROPAA	CUARTA	PUBLICO	t
2207	PROPPA - ZONA NORTE	700066200	43	SARMIENTO	PROPAA	PRIMERA	PUBLICO	t
2208	PROPAA - ZONA OESTE ANEXO 23	700066423	38	PROVINCIA DE BUENOS AIRES	PROPAA	CUARTA	PUBLICO	t
2209	PROPPA -  ZONA SUR ANEXO	700066123	349	JOSE MANUEL ESTRADA	PROPAA	CUARTA	PUBLICO	t
2210	PROVINCIA DE CHUBUT ANEXO	700045001	153	24 DE SEPTIEMBRE - EMER	PRIMARIO	PRIMERA	PUBLICO	t
2211	ESCUELA SECUNDARIA BLAS PARERA	700113800	544	ESCUELA SECUNDARIA BLAS PARERA	SECUNDARIO	TERCERA	PUBLICO	t
2212	ESCUELA SECUNDARIA WERFIELD SALINAS	700111900	545	ESCUELA SECUNDARIA WERFIELD SALINAS	SECUNDARIO	TERCERA	PUBLICO	t
\.


--
-- Data for Name: licitacion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.licitacion (id_licitacion, nro_expediente, fecha_apertura, objeto) FROM stdin;
\.


--
-- Data for Name: movimiento_stock; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.movimiento_stock (id_movimiento, id_producto, cantidad, tipo, id_detalle_ingreso, id_detalle_orden, fecha_movimiento, id_usuario, motivo) FROM stdin;
3	3	1	ingreso	\N	\N	2026-04-08 09:49:05.356349	10	COMPRA
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
-- Data for Name: producto; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.producto (id_producto, nombre, unidad_medida, stock_minimo, id_categoria, stock_actual) FROM stdin;
1	Resma A4	paquete	10	\N	0
2	Lavandina	unidad	1	\N	0
3	Lavandina	litros	5	\N	0
\.


--
-- Data for Name: proveedor; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.proveedor (id_proveedor, nombre, cuit, contacto) FROM stdin;
\.


--
-- Data for Name: rol; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rol (id_rol, nombre) FROM stdin;
1	admin
2	directivo
3	operador
4	consulta
\.


--
-- Data for Name: usuario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuario (id_usuario, nombre, apellido, dni, email, password, telefono, id_institucion, role, activo, created_at) FROM stdin;
10	Administrador	Inicial	00000000	admin@depo.local	$2a$10$BPyZZaYRDLkSDIqnf./yBe5qiPQUnuX7IJdSDCaa50vU/uYAdZRsG	\N	\N	admin	t	2026-04-08 09:45:24.200099
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

SELECT pg_catalog.setval('public.direccion_id_direccion_seq', 545, true);


--
-- Name: edificio_id_edificio_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.edificio_id_edificio_seq', 545, true);


--
-- Name: ingreso_id_ingreso_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ingreso_id_ingreso_seq', 1, false);


--
-- Name: institucion_id_institucion_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.institucion_id_institucion_seq', 2212, true);


--
-- Name: licitacion_id_licitacion_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.licitacion_id_licitacion_seq', 1, false);


--
-- Name: movimiento_stock_id_movimiento_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.movimiento_stock_id_movimiento_seq', 3, true);


--
-- Name: orden_dispensacion_id_orden_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orden_dispensacion_id_orden_seq', 1, false);


--
-- Name: pedido_id_pedido_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pedido_id_pedido_seq', 1, false);


--
-- Name: producto_id_producto_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.producto_id_producto_seq', 3, true);


--
-- Name: proveedor_id_proveedor_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.proveedor_id_proveedor_seq', 1, false);


--
-- Name: rol_id_rol_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rol_id_rol_seq', 4, true);


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.usuario_id_usuario_seq', 10, true);


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
-- Name: institucion institucion_cue_nivel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institucion
    ADD CONSTRAINT institucion_cue_nivel_key UNIQUE (cue, nivel_educativo);


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
-- Name: idx_movimiento_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimiento_producto ON public.movimiento_stock USING btree (id_producto);


--
-- Name: idx_orden_institucion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orden_institucion ON public.orden_dispensacion USING btree (id_institucion);


--
-- Name: idx_pedido_institucion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedido_institucion ON public.pedido USING btree (id_institucion);


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
-- Name: auditoria auditoria_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id_usuario);


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
-- Name: edificio fk_direccion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edificio
    ADD CONSTRAINT fk_direccion FOREIGN KEY (id_direccion) REFERENCES public.direccion(id_direccion);


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
-- Name: producto producto_id_categoria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT producto_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.categoria(id_categoria);


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

\unrestrict 6oSo2h90lB1l5yUD9gCmoNByG4uYrwfVuhUqYV8HjA4VpS5mUwDWdWo0t28eskH

