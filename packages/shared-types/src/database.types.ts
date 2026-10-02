// GENERADO por scripts/gen-db-types.mjs desde supabase/migrations — no editar a mano.
// Regenerar: pnpm db:types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13';
  };
  public: {
    Tables: {
      academia: {
        Row: {
          actualizado_at: string;
          ciudad: string | null;
          creado_at: string;
          creado_por: string | null;
          email: string | null;
          id: string;
          nombre: string;
          pais: string | null;
          redes: Json;
          region: string | null;
          telefono: string | null;
        };
        Insert: {
          actualizado_at?: string;
          ciudad?: string | null;
          creado_at?: string;
          creado_por?: string | null;
          email?: string | null;
          id?: string;
          nombre: string;
          pais?: string | null;
          redes?: Json;
          region?: string | null;
          telefono?: string | null;
        };
        Update: {
          actualizado_at?: string;
          ciudad?: string | null;
          creado_at?: string;
          creado_por?: string | null;
          email?: string | null;
          id?: string;
          nombre?: string;
          pais?: string | null;
          redes?: Json;
          region?: string | null;
          telefono?: string | null;
        };
        Relationships: [

        ];
      };
      academia_invitacion: {
        Row: {
          academia_id: string;
          aceptada_at: string | null;
          creado_at: string;
          email: string;
          id: string;
          invitado_por: string | null;
          token: string;
          vence_at: string;
        };
        Insert: {
          academia_id: string;
          aceptada_at?: string | null;
          creado_at?: string;
          email: string;
          id?: string;
          invitado_por?: string | null;
          token?: string;
          vence_at?: string;
        };
        Update: {
          academia_id?: string;
          aceptada_at?: string | null;
          creado_at?: string;
          email?: string;
          id?: string;
          invitado_por?: string | null;
          token?: string;
          vence_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academia_invitacion_academia_id_fkey";
            columns: ["academia_id"];
            isOneToOne: false;
            referencedRelation: "academia";
            referencedColumns: ["id"];
          },
        ];
      };
      academia_miembro: {
        Row: {
          academia_id: string;
          activo: boolean;
          creado_at: string;
          rol: string;
          usuario_id: string;
        };
        Insert: {
          academia_id: string;
          activo?: boolean;
          creado_at?: string;
          rol?: string;
          usuario_id: string;
        };
        Update: {
          academia_id?: string;
          activo?: boolean;
          creado_at?: string;
          rol?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academia_miembro_academia_id_fkey";
            columns: ["academia_id"];
            isOneToOne: false;
            referencedRelation: "academia";
            referencedColumns: ["id"];
          },
        ];
      };
      acreditacion_registro: {
        Row: {
          accion: string;
          client_uuid: string;
          credencial_id: string;
          dispositivo_at: string | null;
          evento_id: string;
          id: string;
          registrado_at: string;
          registrado_por: string;
          zona: string | null;
        };
        Insert: {
          accion: string;
          client_uuid: string;
          credencial_id: string;
          dispositivo_at?: string | null;
          evento_id: string;
          id?: string;
          registrado_at?: string;
          registrado_por: string;
          zona?: string | null;
        };
        Update: {
          accion?: string;
          client_uuid?: string;
          credencial_id?: string;
          dispositivo_at?: string | null;
          evento_id?: string;
          id?: string;
          registrado_at?: string;
          registrado_por?: string;
          zona?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "acreditacion_registro_credencial_id_fkey";
            columns: ["credencial_id"];
            isOneToOne: false;
            referencedRelation: "credencial";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acreditacion_registro_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
        ];
      };
      ajuste_liquidacion: {
        Row: {
          academia_id: string;
          anulado_at: string | null;
          creado_at: string;
          creado_por: string | null;
          evento_id: string;
          id: string;
          inscripcion_id: string;
          monto_centavos: number | null;
          motivo: string;
          porcentaje: number | null;
          tipo: string;
        };
        Insert: {
          academia_id: string;
          anulado_at?: string | null;
          creado_at?: string;
          creado_por?: string | null;
          evento_id: string;
          id?: string;
          inscripcion_id: string;
          monto_centavos?: number | null;
          motivo: string;
          porcentaje?: number | null;
          tipo: string;
        };
        Update: {
          academia_id?: string;
          anulado_at?: string | null;
          creado_at?: string;
          creado_por?: string | null;
          evento_id?: string;
          id?: string;
          inscripcion_id?: string;
          monto_centavos?: number | null;
          motivo?: string;
          porcentaje?: number | null;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ajuste_liquidacion_inscripcion_id_evento_id_academia_id_fkey";
            columns: ["inscripcion_id","evento_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "inscripcion";
            referencedColumns: ["id","evento_id","academia_id"];
          },
        ];
      };
      auditoria: {
        Row: {
          accion: string;
          antes: Json | null;
          despues: Json | null;
          evento_id: string | null;
          id: number;
          ocurrido_at: string;
          registro_id: string | null;
          rol_sesion: string | null;
          tabla: string;
          usuario_id: string | null;
        };
        Insert: {
          accion: string;
          antes?: Json | null;
          despues?: Json | null;
          evento_id?: string | null;
          ocurrido_at?: string;
          registro_id?: string | null;
          rol_sesion?: string | null;
          tabla: string;
          usuario_id?: string | null;
        };
        Update: {
          accion?: string;
          antes?: Json | null;
          despues?: Json | null;
          evento_id?: string | null;
          ocurrido_at?: string;
          registro_id?: string | null;
          rol_sesion?: string | null;
          tabla?: string;
          usuario_id?: string | null;
        };
        Relationships: [

        ];
      };
      bailarin: {
        Row: {
          academia_id: string;
          activo: boolean;
          actualizado_at: string;
          apellido: string;
          creado_at: string;
          documento_numero: string | null;
          documento_tipo: string | null;
          fecha_nacimiento: string;
          id: string;
          nombre: string;
        };
        Insert: {
          academia_id: string;
          activo?: boolean;
          actualizado_at?: string;
          apellido: string;
          creado_at?: string;
          documento_numero?: string | null;
          documento_tipo?: string | null;
          fecha_nacimiento: string;
          id?: string;
          nombre: string;
        };
        Update: {
          academia_id?: string;
          activo?: boolean;
          actualizado_at?: string;
          apellido?: string;
          creado_at?: string;
          documento_numero?: string | null;
          documento_tipo?: string | null;
          fecha_nacimiento?: string;
          id?: string;
          nombre?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bailarin_academia_id_fkey";
            columns: ["academia_id"];
            isOneToOne: false;
            referencedRelation: "academia";
            referencedColumns: ["id"];
          },
        ];
      };
      bloque: {
        Row: {
          evento_id: string;
          id: string;
          inicio_programado: string | null;
          nombre: Json;
          orden: number;
          pista_id: string;
        };
        Insert: {
          evento_id: string;
          id?: string;
          inicio_programado?: string | null;
          nombre: Json;
          orden?: number;
          pista_id: string;
        };
        Update: {
          evento_id?: string;
          id?: string;
          inicio_programado?: string | null;
          nombre?: Json;
          orden?: number;
          pista_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bloque_pista_id_evento_id_fkey";
            columns: ["pista_id","evento_id"];
            isOneToOne: false;
            referencedRelation: "pista";
            referencedColumns: ["id","evento_id"];
          },
        ];
      };
      campo_adicional: {
        Row: {
          codigo: string;
          entidad: string;
          etiqueta: Json;
          evento_id: string;
          id: string;
          obligatorio: boolean;
          opciones: Json;
          orden: number;
          tipo: string;
        };
        Insert: {
          codigo: string;
          entidad: string;
          etiqueta: Json;
          evento_id: string;
          id?: string;
          obligatorio?: boolean;
          opciones?: Json;
          orden?: number;
          tipo: string;
        };
        Update: {
          codigo?: string;
          entidad?: string;
          etiqueta?: Json;
          evento_id?: string;
          id?: string;
          obligatorio?: boolean;
          opciones?: Json;
          orden?: number;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campo_adicional_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
        ];
      };
      clase: {
        Row: {
          cupo: number;
          docente: string | null;
          evento_id: string;
          fin: string;
          id: string;
          inicio: string;
          nombre: Json;
          precio_centavos: number;
          publicada: boolean;
          sala: string | null;
        };
        Insert: {
          cupo: number;
          docente?: string | null;
          evento_id: string;
          fin: string;
          id?: string;
          inicio: string;
          nombre: Json;
          precio_centavos?: number;
          publicada?: boolean;
          sala?: string | null;
        };
        Update: {
          cupo?: number;
          docente?: string | null;
          evento_id?: string;
          fin?: string;
          id?: string;
          inicio?: string;
          nombre?: Json;
          precio_centavos?: number;
          publicada?: boolean;
          sala?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clase_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
        ];
      };
      cobro: {
        Row: {
          academia_id: string;
          anulado_at: string | null;
          anulado_por: string | null;
          client_uuid: string;
          dispositivo_at: string | null;
          evento_id: string;
          id: string;
          liquidacion_id: string;
          medio: string;
          moneda: string;
          monto_centavos: number;
          motivo_anulacion: string | null;
          nota: string | null;
          referencia: string | null;
          registrado_at: string;
          registrado_por: string;
          turno_caja_id: string | null;
        };
        Insert: {
          academia_id: string;
          anulado_at?: string | null;
          anulado_por?: string | null;
          client_uuid: string;
          dispositivo_at?: string | null;
          evento_id: string;
          id?: string;
          liquidacion_id: string;
          medio: string;
          moneda: string;
          monto_centavos: number;
          motivo_anulacion?: string | null;
          nota?: string | null;
          referencia?: string | null;
          registrado_at?: string;
          registrado_por: string;
          turno_caja_id?: string | null;
        };
        Update: {
          academia_id?: string;
          anulado_at?: string | null;
          anulado_por?: string | null;
          client_uuid?: string;
          dispositivo_at?: string | null;
          evento_id?: string;
          id?: string;
          liquidacion_id?: string;
          medio?: string;
          moneda?: string;
          monto_centavos?: number;
          motivo_anulacion?: string | null;
          nota?: string | null;
          referencia?: string | null;
          registrado_at?: string;
          registrado_por?: string;
          turno_caja_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cobro_liquidacion_id_evento_id_academia_id_fkey";
            columns: ["liquidacion_id","evento_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "liquidacion";
            referencedColumns: ["id","evento_id","academia_id"];
          },
          {
            foreignKeyName: "cobro_moneda_fkey";
            columns: ["moneda"];
            isOneToOne: false;
            referencedRelation: "moneda";
            referencedColumns: ["codigo"];
          },
          {
            foreignKeyName: "cobro_turno_caja_id_fkey";
            columns: ["turno_caja_id"];
            isOneToOne: false;
            referencedRelation: "turno_caja";
            referencedColumns: ["id"];
          },
        ];
      };
      comunicado: {
        Row: {
          asunto: Json;
          audiencia: string[];
          creado_at: string;
          creado_por: string | null;
          cuerpo: Json;
          enviado_at: string | null;
          estado: string;
          evento_id: string;
          id: string;
        };
        Insert: {
          asunto: Json;
          audiencia: string[];
          creado_at?: string;
          creado_por?: string | null;
          cuerpo: Json;
          enviado_at?: string | null;
          estado?: string;
          evento_id: string;
          id?: string;
        };
        Update: {
          asunto?: Json;
          audiencia?: string[];
          creado_at?: string;
          creado_por?: string | null;
          cuerpo?: Json;
          enviado_at?: string | null;
          estado?: string;
          evento_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comunicado_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
        ];
      };
      coreografia: {
        Row: {
          academia_id: string;
          activa: boolean;
          actualizado_at: string;
          coreografo: string | null;
          creado_at: string;
          formacion: string;
          genero: string;
          id: string;
          musica_duracion_seg: number | null;
          musica_nombre: string | null;
          musica_path: string | null;
          musica_subida_at: string | null;
          nombre: string;
        };
        Insert: {
          academia_id: string;
          activa?: boolean;
          actualizado_at?: string;
          coreografo?: string | null;
          creado_at?: string;
          formacion: string;
          genero: string;
          id?: string;
          musica_duracion_seg?: number | null;
          musica_nombre?: string | null;
          musica_path?: string | null;
          musica_subida_at?: string | null;
          nombre: string;
        };
        Update: {
          academia_id?: string;
          activa?: boolean;
          actualizado_at?: string;
          coreografo?: string | null;
          creado_at?: string;
          formacion?: string;
          genero?: string;
          id?: string;
          musica_duracion_seg?: number | null;
          musica_nombre?: string | null;
          musica_path?: string | null;
          musica_subida_at?: string | null;
          nombre?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coreografia_academia_id_fkey";
            columns: ["academia_id"];
            isOneToOne: false;
            referencedRelation: "academia";
            referencedColumns: ["id"];
          },
        ];
      };
      coreografia_bailarin: {
        Row: {
          academia_id: string;
          bailarin_id: string;
          coreografia_id: string;
          es_coreografo: boolean;
        };
        Insert: {
          academia_id: string;
          bailarin_id: string;
          coreografia_id: string;
          es_coreografo?: boolean;
        };
        Update: {
          academia_id?: string;
          bailarin_id?: string;
          coreografia_id?: string;
          es_coreografo?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "coreografia_bailarin_bailarin_id_academia_id_fkey";
            columns: ["bailarin_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "bailarin";
            referencedColumns: ["id","academia_id"];
          },
          {
            foreignKeyName: "coreografia_bailarin_coreografia_id_academia_id_fkey";
            columns: ["coreografia_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "coreografia";
            referencedColumns: ["id","academia_id"];
          },
        ];
      };
      credencial: {
        Row: {
          academia_id: string | null;
          acreditado_at: string | null;
          acreditado_por: string | null;
          anulada: boolean;
          bailarin_id: string | null;
          creado_at: string;
          evento_id: string;
          id: string;
          nombre_mostrado: string;
          qr_token: string;
          tipo: string;
          usuario_id: string | null;
          zonas: string[];
        };
        Insert: {
          academia_id?: string | null;
          acreditado_at?: string | null;
          acreditado_por?: string | null;
          anulada?: boolean;
          bailarin_id?: string | null;
          creado_at?: string;
          evento_id: string;
          id?: string;
          nombre_mostrado: string;
          qr_token?: string;
          tipo: string;
          usuario_id?: string | null;
          zonas?: string[];
        };
        Update: {
          academia_id?: string | null;
          acreditado_at?: string | null;
          acreditado_por?: string | null;
          anulada?: boolean;
          bailarin_id?: string | null;
          creado_at?: string;
          evento_id?: string;
          id?: string;
          nombre_mostrado?: string;
          qr_token?: string;
          tipo?: string;
          usuario_id?: string | null;
          zonas?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "credencial_academia_id_fkey";
            columns: ["academia_id"];
            isOneToOne: false;
            referencedRelation: "academia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credencial_bailarin_id_academia_id_fkey";
            columns: ["bailarin_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "bailarin";
            referencedColumns: ["id","academia_id"];
          },
          {
            foreignKeyName: "credencial_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
        ];
      };
      criterio: {
        Row: {
          codigo: string;
          evento_id: string;
          id: string;
          nombre: Json;
          orden: number;
          peso: number;
        };
        Insert: {
          codigo: string;
          evento_id: string;
          id?: string;
          nombre: Json;
          orden?: number;
          peso?: number;
        };
        Update: {
          codigo?: string;
          evento_id?: string;
          id?: string;
          nombre?: Json;
          orden?: number;
          peso?: number;
        };
        Relationships: [
          {
            foreignKeyName: "criterio_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
        ];
      };
      email_envio: {
        Row: {
          creado_at: string;
          destinatario: string;
          enviado_at: string | null;
          error: string | null;
          estado: string;
          evento_id: string | null;
          id: string;
          idioma: string;
          intentos: number;
          payload: Json;
          plantilla: string;
          proveedor_id: string | null;
          usuario_id: string | null;
        };
        Insert: {
          creado_at?: string;
          destinatario: string;
          enviado_at?: string | null;
          error?: string | null;
          estado?: string;
          evento_id?: string | null;
          id?: string;
          idioma: string;
          intentos?: number;
          payload?: Json;
          plantilla: string;
          proveedor_id?: string | null;
          usuario_id?: string | null;
        };
        Update: {
          creado_at?: string;
          destinatario?: string;
          enviado_at?: string | null;
          error?: string | null;
          estado?: string;
          evento_id?: string | null;
          id?: string;
          idioma?: string;
          intentos?: number;
          payload?: Json;
          plantilla?: string;
          proveedor_id?: string | null;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_envio_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_envio_idioma_fkey";
            columns: ["idioma"];
            isOneToOne: false;
            referencedRelation: "idioma";
            referencedColumns: ["codigo"];
          },
        ];
      };
      entrada_tipo: {
        Row: {
          cupo: number;
          evento_id: string;
          fecha: string | null;
          id: string;
          nombre: Json;
          precio_centavos: number;
          publicada: boolean;
        };
        Insert: {
          cupo: number;
          evento_id: string;
          fecha?: string | null;
          id?: string;
          nombre: Json;
          precio_centavos: number;
          publicada?: boolean;
        };
        Update: {
          cupo?: number;
          evento_id?: string;
          fecha?: string | null;
          id?: string;
          nombre?: Json;
          precio_centavos?: number;
          publicada?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "entrada_tipo_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
        ];
      };
      evento: {
        Row: {
          acreditacion: Json;
          actualizado_at: string;
          bases: Json;
          config_operacion: Json;
          creado_at: string;
          creado_por: string | null;
          cupo_fichas: number | null;
          datos_pago: Json;
          estado: string;
          fecha_fin: string;
          fecha_inicio: string;
          id: string;
          idioma_defecto: string;
          inscripcion_apertura: string | null;
          inscripcion_cierre: string | null;
          medios_cobro: string[];
          modificaciones_cierre: string | null;
          moneda: string;
          nombre: Json;
          orden_publicado_at: string | null;
          publicado: boolean;
          reglamento: Json;
          reglamento_version: number;
          resultados_publicados_at: string | null;
          sede: Json;
          slug: string;
          tarifario: Json;
          temporada_id: string;
          tipo: string;
          zona_horaria: string;
        };
        Insert: {
          acreditacion?: Json;
          actualizado_at?: string;
          bases?: Json;
          config_operacion?: Json;
          creado_at?: string;
          creado_por?: string | null;
          cupo_fichas?: number | null;
          datos_pago?: Json;
          estado?: string;
          fecha_fin: string;
          fecha_inicio: string;
          id?: string;
          idioma_defecto?: string;
          inscripcion_apertura?: string | null;
          inscripcion_cierre?: string | null;
          medios_cobro?: string[];
          modificaciones_cierre?: string | null;
          moneda: string;
          nombre: Json;
          orden_publicado_at?: string | null;
          publicado?: boolean;
          reglamento: Json;
          reglamento_version?: number;
          resultados_publicados_at?: string | null;
          sede?: Json;
          slug: string;
          tarifario?: Json;
          temporada_id: string;
          tipo: string;
          zona_horaria?: string;
        };
        Update: {
          acreditacion?: Json;
          actualizado_at?: string;
          bases?: Json;
          config_operacion?: Json;
          creado_at?: string;
          creado_por?: string | null;
          cupo_fichas?: number | null;
          datos_pago?: Json;
          estado?: string;
          fecha_fin?: string;
          fecha_inicio?: string;
          id?: string;
          idioma_defecto?: string;
          inscripcion_apertura?: string | null;
          inscripcion_cierre?: string | null;
          medios_cobro?: string[];
          modificaciones_cierre?: string | null;
          moneda?: string;
          nombre?: Json;
          orden_publicado_at?: string | null;
          publicado?: boolean;
          reglamento?: Json;
          reglamento_version?: number;
          resultados_publicados_at?: string | null;
          sede?: Json;
          slug?: string;
          tarifario?: Json;
          temporada_id?: string;
          tipo?: string;
          zona_horaria?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evento_idioma_defecto_fkey";
            columns: ["idioma_defecto"];
            isOneToOne: false;
            referencedRelation: "idioma";
            referencedColumns: ["codigo"];
          },
          {
            foreignKeyName: "evento_moneda_fkey";
            columns: ["moneda"];
            isOneToOne: false;
            referencedRelation: "moneda";
            referencedColumns: ["codigo"];
          },
          {
            foreignKeyName: "evento_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: false;
            referencedRelation: "temporada";
            referencedColumns: ["id"];
          },
        ];
      };
      evento_contador: {
        Row: {
          evento_id: string;
          tipo: string;
          ultimo: number;
        };
        Insert: {
          evento_id: string;
          tipo: string;
          ultimo?: number;
        };
        Update: {
          evento_id?: string;
          tipo?: string;
          ultimo?: number;
        };
        Relationships: [
          {
            foreignKeyName: "evento_contador_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
        ];
      };
      evento_miembro: {
        Row: {
          activo: boolean;
          asignado_at: string;
          asignado_por: string | null;
          evento_id: string;
          rol: string;
          usuario_id: string;
        };
        Insert: {
          activo?: boolean;
          asignado_at?: string;
          asignado_por?: string | null;
          evento_id: string;
          rol: string;
          usuario_id: string;
        };
        Update: {
          activo?: boolean;
          asignado_at?: string;
          asignado_por?: string | null;
          evento_id?: string;
          rol?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evento_miembro_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evento_miembro_rol_fkey";
            columns: ["rol"];
            isOneToOne: false;
            referencedRelation: "rol";
            referencedColumns: ["codigo"];
          },
        ];
      };
      ficha: {
        Row: {
          academia_id: string;
          actualizado_at: string;
          bloqueada: boolean;
          categoria: string | null;
          categoria_declarada: string | null;
          coreografia_id: string;
          creado_at: string;
          creado_por: string | null;
          datos_adicionales: Json;
          enviada_at: string | null;
          estado: string;
          evento_id: string;
          excepcion: Json | null;
          formacion: string;
          genero: string;
          id: string;
          inscripcion_id: string;
          musica_duracion_seg: number | null;
          musica_path: string | null;
          nombre: string;
          observacion: string | null;
          validacion: Json | null;
          validacion_reglamento_version: number | null;
        };
        Insert: {
          academia_id: string;
          actualizado_at?: string;
          bloqueada?: boolean;
          categoria?: string | null;
          categoria_declarada?: string | null;
          coreografia_id: string;
          creado_at?: string;
          creado_por?: string | null;
          datos_adicionales?: Json;
          enviada_at?: string | null;
          estado?: string;
          evento_id: string;
          excepcion?: Json | null;
          formacion: string;
          genero: string;
          id?: string;
          inscripcion_id: string;
          musica_duracion_seg?: number | null;
          musica_path?: string | null;
          nombre: string;
          observacion?: string | null;
          validacion?: Json | null;
          validacion_reglamento_version?: number | null;
        };
        Update: {
          academia_id?: string;
          actualizado_at?: string;
          bloqueada?: boolean;
          categoria?: string | null;
          categoria_declarada?: string | null;
          coreografia_id?: string;
          creado_at?: string;
          creado_por?: string | null;
          datos_adicionales?: Json;
          enviada_at?: string | null;
          estado?: string;
          evento_id?: string;
          excepcion?: Json | null;
          formacion?: string;
          genero?: string;
          id?: string;
          inscripcion_id?: string;
          musica_duracion_seg?: number | null;
          musica_path?: string | null;
          nombre?: string;
          observacion?: string | null;
          validacion?: Json | null;
          validacion_reglamento_version?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ficha_coreografia_id_academia_id_fkey";
            columns: ["coreografia_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "coreografia";
            referencedColumns: ["id","academia_id"];
          },
          {
            foreignKeyName: "ficha_inscripcion_id_evento_id_academia_id_fkey";
            columns: ["inscripcion_id","evento_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "inscripcion";
            referencedColumns: ["id","evento_id","academia_id"];
          },
        ];
      };
      ficha_bailarin: {
        Row: {
          academia_id: string;
          bailarin_id: string;
          categoria: string | null;
          edad: number | null;
          es_coreografo: boolean;
          evento_id: string;
          ficha_id: string;
          nombre_mostrado: string;
        };
        Insert: {
          academia_id: string;
          bailarin_id: string;
          categoria?: string | null;
          edad?: number | null;
          es_coreografo?: boolean;
          evento_id: string;
          ficha_id: string;
          nombre_mostrado: string;
        };
        Update: {
          academia_id?: string;
          bailarin_id?: string;
          categoria?: string | null;
          edad?: number | null;
          es_coreografo?: boolean;
          evento_id?: string;
          ficha_id?: string;
          nombre_mostrado?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ficha_bailarin_bailarin_id_academia_id_fkey";
            columns: ["bailarin_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "bailarin";
            referencedColumns: ["id","academia_id"];
          },
          {
            foreignKeyName: "ficha_bailarin_ficha_id_evento_id_academia_id_fkey";
            columns: ["ficha_id","evento_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "ficha";
            referencedColumns: ["id","evento_id","academia_id"];
          },
        ];
      };
      hotel: {
        Row: {
          criterio_asignacion: string;
          cupo: number;
          descripcion: Json;
          evento_id: string;
          id: string;
          nombre: string;
          precio_centavos: number | null;
        };
        Insert: {
          criterio_asignacion?: string;
          cupo: number;
          descripcion?: Json;
          evento_id: string;
          id?: string;
          nombre: string;
          precio_centavos?: number | null;
        };
        Update: {
          criterio_asignacion?: string;
          cupo?: number;
          descripcion?: Json;
          evento_id?: string;
          id?: string;
          nombre?: string;
          precio_centavos?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "hotel_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
        ];
      };
      hotel_solicitud: {
        Row: {
          academia_id: string;
          creado_at: string;
          evento_id: string;
          hotel_id: string;
          id: string;
          inscripcion_id: string;
          plazas: number;
        };
        Insert: {
          academia_id: string;
          creado_at?: string;
          evento_id: string;
          hotel_id: string;
          id?: string;
          inscripcion_id: string;
          plazas: number;
        };
        Update: {
          academia_id?: string;
          creado_at?: string;
          evento_id?: string;
          hotel_id?: string;
          id?: string;
          inscripcion_id?: string;
          plazas?: number;
        };
        Relationships: [
          {
            foreignKeyName: "hotel_solicitud_hotel_id_evento_id_fkey";
            columns: ["hotel_id","evento_id"];
            isOneToOne: false;
            referencedRelation: "hotel";
            referencedColumns: ["id","evento_id"];
          },
          {
            foreignKeyName: "hotel_solicitud_inscripcion_id_evento_id_academia_id_fkey";
            columns: ["inscripcion_id","evento_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "inscripcion";
            referencedColumns: ["id","evento_id","academia_id"];
          },
        ];
      };
      idioma: {
        Row: {
          activo: boolean;
          codigo: string;
          nombre: string;
        };
        Insert: {
          activo?: boolean;
          codigo: string;
          nombre: string;
        };
        Update: {
          activo?: boolean;
          codigo?: string;
          nombre?: string;
        };
        Relationships: [

        ];
      };
      inscripcion: {
        Row: {
          academia_id: string;
          actualizado_at: string;
          creado_por: string | null;
          datos_adicionales: Json;
          estado: string;
          evento_id: string;
          id: string;
          inscripta_at: string;
          rubros: Json;
        };
        Insert: {
          academia_id: string;
          actualizado_at?: string;
          creado_por?: string | null;
          datos_adicionales?: Json;
          estado?: string;
          evento_id: string;
          id?: string;
          inscripta_at?: string;
          rubros?: Json;
        };
        Update: {
          academia_id?: string;
          actualizado_at?: string;
          creado_por?: string | null;
          datos_adicionales?: Json;
          estado?: string;
          evento_id?: string;
          id?: string;
          inscripta_at?: string;
          rubros?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "inscripcion_academia_id_fkey";
            columns: ["academia_id"];
            isOneToOne: false;
            referencedRelation: "academia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inscripcion_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
        ];
      };
      liquidacion: {
        Row: {
          academia_id: string;
          correlativo: number;
          creado_at: string;
          evento_id: string;
          id: string;
          inscripcion_id: string;
          numero: string;
        };
        Insert: {
          academia_id: string;
          correlativo: number;
          creado_at?: string;
          evento_id: string;
          id?: string;
          inscripcion_id: string;
          numero: string;
        };
        Update: {
          academia_id?: string;
          correlativo?: number;
          creado_at?: string;
          evento_id?: string;
          id?: string;
          inscripcion_id?: string;
          numero?: string;
        };
        Relationships: [
          {
            foreignKeyName: "liquidacion_inscripcion_id_evento_id_academia_id_fkey";
            columns: ["inscripcion_id","evento_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "inscripcion";
            referencedColumns: ["id","evento_id","academia_id"];
          },
        ];
      };
      liquidacion_version: {
        Row: {
          academia_id: string;
          detalle: Json;
          emitida_at: string;
          emitida_por: string | null;
          evento_id: string;
          id: string;
          idioma: string;
          liquidacion_id: string;
          moneda: string;
          pdf_path: string | null;
          qr_token: string;
          total_centavos: number;
          version: number;
        };
        Insert: {
          academia_id: string;
          detalle: Json;
          emitida_at?: string;
          emitida_por?: string | null;
          evento_id: string;
          id?: string;
          idioma?: string;
          liquidacion_id: string;
          moneda: string;
          pdf_path?: string | null;
          qr_token?: string;
          total_centavos: number;
          version: number;
        };
        Update: {
          academia_id?: string;
          detalle?: Json;
          emitida_at?: string;
          emitida_por?: string | null;
          evento_id?: string;
          id?: string;
          idioma?: string;
          liquidacion_id?: string;
          moneda?: string;
          pdf_path?: string | null;
          qr_token?: string;
          total_centavos?: number;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "liquidacion_version_idioma_fkey";
            columns: ["idioma"];
            isOneToOne: false;
            referencedRelation: "idioma";
            referencedColumns: ["codigo"];
          },
          {
            foreignKeyName: "liquidacion_version_liquidacion_id_evento_id_academia_id_fkey";
            columns: ["liquidacion_id","evento_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "liquidacion";
            referencedColumns: ["id","evento_id","academia_id"];
          },
          {
            foreignKeyName: "liquidacion_version_moneda_fkey";
            columns: ["moneda"];
            isOneToOne: false;
            referencedRelation: "moneda";
            referencedColumns: ["codigo"];
          },
        ];
      };
      moneda: {
        Row: {
          activo: boolean;
          codigo: string;
          decimales: number;
        };
        Insert: {
          activo?: boolean;
          codigo: string;
          decimales?: number;
        };
        Update: {
          activo?: boolean;
          codigo?: string;
          decimales?: number;
        };
        Relationships: [

        ];
      };
      orden_item: {
        Row: {
          actualizado_at: string;
          actualizado_por: string | null;
          bloque_id: string;
          estado: string;
          evento_id: string;
          ficha_id: string;
          id: string;
          pista_id: string;
          posicion: number;
        };
        Insert: {
          actualizado_at?: string;
          actualizado_por?: string | null;
          bloque_id: string;
          estado?: string;
          evento_id: string;
          ficha_id: string;
          id?: string;
          pista_id: string;
          posicion: number;
        };
        Update: {
          actualizado_at?: string;
          actualizado_por?: string | null;
          bloque_id?: string;
          estado?: string;
          evento_id?: string;
          ficha_id?: string;
          id?: string;
          pista_id?: string;
          posicion?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orden_item_bloque_id_evento_id_fkey";
            columns: ["bloque_id","evento_id"];
            isOneToOne: false;
            referencedRelation: "bloque";
            referencedColumns: ["id","evento_id"];
          },
          {
            foreignKeyName: "orden_item_bloque_id_pista_id_fkey";
            columns: ["bloque_id","pista_id"];
            isOneToOne: false;
            referencedRelation: "bloque";
            referencedColumns: ["id","pista_id"];
          },
          {
            foreignKeyName: "orden_item_ficha_id_fkey";
            columns: ["ficha_id"];
            isOneToOne: false;
            referencedRelation: "ficha";
            referencedColumns: ["id"];
          },
        ];
      };
      pase: {
        Row: {
          academia_id: string;
          anulado_at: string | null;
          anulado_por: string | null;
          beneficio: Json | null;
          coreografia_id: string | null;
          evento_destino_id: string;
          evento_origen_id: string | null;
          id: string;
          motivo: string;
          motivo_anulacion: string | null;
          registrado_at: string;
          registrado_por: string;
        };
        Insert: {
          academia_id: string;
          anulado_at?: string | null;
          anulado_por?: string | null;
          beneficio?: Json | null;
          coreografia_id?: string | null;
          evento_destino_id: string;
          evento_origen_id?: string | null;
          id?: string;
          motivo: string;
          motivo_anulacion?: string | null;
          registrado_at?: string;
          registrado_por: string;
        };
        Update: {
          academia_id?: string;
          anulado_at?: string | null;
          anulado_por?: string | null;
          beneficio?: Json | null;
          coreografia_id?: string | null;
          evento_destino_id?: string;
          evento_origen_id?: string | null;
          id?: string;
          motivo?: string;
          motivo_anulacion?: string | null;
          registrado_at?: string;
          registrado_por?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pase_academia_id_fkey";
            columns: ["academia_id"];
            isOneToOne: false;
            referencedRelation: "academia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pase_coreografia_id_academia_id_fkey";
            columns: ["coreografia_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "coreografia";
            referencedColumns: ["id","academia_id"];
          },
          {
            foreignKeyName: "pase_evento_destino_id_fkey";
            columns: ["evento_destino_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pase_evento_origen_id_fkey";
            columns: ["evento_origen_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
        ];
      };
      perfil: {
        Row: {
          actualizado_at: string;
          creado_at: string;
          email: string | null;
          id: string;
          idioma: string;
          nombre: string;
          telefono: string | null;
        };
        Insert: {
          actualizado_at?: string;
          creado_at?: string;
          email?: string | null;
          id: string;
          idioma?: string;
          nombre?: string;
          telefono?: string | null;
        };
        Update: {
          actualizado_at?: string;
          creado_at?: string;
          email?: string | null;
          id?: string;
          idioma?: string;
          nombre?: string;
          telefono?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "perfil_idioma_fkey";
            columns: ["idioma"];
            isOneToOne: false;
            referencedRelation: "idioma";
            referencedColumns: ["codigo"];
          },
        ];
      };
      permiso: {
        Row: {
          codigo: string;
          descripcion: string;
        };
        Insert: {
          codigo: string;
          descripcion: string;
        };
        Update: {
          codigo?: string;
          descripcion?: string;
        };
        Relationships: [

        ];
      };
      pista: {
        Row: {
          evento_id: string;
          id: string;
          nombre: Json;
          orden: number;
        };
        Insert: {
          evento_id: string;
          id?: string;
          nombre: Json;
          orden?: number;
        };
        Update: {
          evento_id?: string;
          id?: string;
          nombre?: Json;
          orden?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pista_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
        ];
      };
      planilla: {
        Row: {
          academia_id: string;
          actualizado_at: string;
          client_uuid: string | null;
          comentario: string | null;
          enviada_at: string | null;
          estado: string;
          evento_id: string;
          ficha_id: string;
          id: string;
          jurado_id: string;
          motivo_reapertura: string | null;
          reabierta_por: string | null;
          total: number | null;
        };
        Insert: {
          academia_id: string;
          actualizado_at?: string;
          client_uuid?: string | null;
          comentario?: string | null;
          enviada_at?: string | null;
          estado?: string;
          evento_id: string;
          ficha_id: string;
          id?: string;
          jurado_id: string;
          motivo_reapertura?: string | null;
          reabierta_por?: string | null;
          total?: number | null;
        };
        Update: {
          academia_id?: string;
          actualizado_at?: string;
          client_uuid?: string | null;
          comentario?: string | null;
          enviada_at?: string | null;
          estado?: string;
          evento_id?: string;
          ficha_id?: string;
          id?: string;
          jurado_id?: string;
          motivo_reapertura?: string | null;
          reabierta_por?: string | null;
          total?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "planilla_ficha_id_evento_id_academia_id_fkey";
            columns: ["ficha_id","evento_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "ficha";
            referencedColumns: ["id","evento_id","academia_id"];
          },
        ];
      };
      planilla_nota: {
        Row: {
          criterio_id: string;
          evento_id: string;
          planilla_id: string;
          valor: number;
        };
        Insert: {
          criterio_id: string;
          evento_id: string;
          planilla_id: string;
          valor: number;
        };
        Update: {
          criterio_id?: string;
          evento_id?: string;
          planilla_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "planilla_nota_criterio_id_evento_id_fkey";
            columns: ["criterio_id","evento_id"];
            isOneToOne: false;
            referencedRelation: "criterio";
            referencedColumns: ["id","evento_id"];
          },
          {
            foreignKeyName: "planilla_nota_planilla_id_evento_id_fkey";
            columns: ["planilla_id","evento_id"];
            isOneToOne: false;
            referencedRelation: "planilla";
            referencedColumns: ["id","evento_id"];
          },
        ];
      };
      premio: {
        Row: {
          criterio: string;
          evento_id: string | null;
          filtro: Json;
          id: string;
          moneda: string | null;
          monto_centavos: number | null;
          nombre: Json;
          orden: number;
          regla_empate: string;
          temporada_id: string;
          tipo: string;
        };
        Insert: {
          criterio?: string;
          evento_id?: string | null;
          filtro?: Json;
          id?: string;
          moneda?: string | null;
          monto_centavos?: number | null;
          nombre: Json;
          orden?: number;
          regla_empate?: string;
          temporada_id: string;
          tipo: string;
        };
        Update: {
          criterio?: string;
          evento_id?: string | null;
          filtro?: Json;
          id?: string;
          moneda?: string | null;
          monto_centavos?: number | null;
          nombre?: Json;
          orden?: number;
          regla_empate?: string;
          temporada_id?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "premio_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premio_moneda_fkey";
            columns: ["moneda"];
            isOneToOne: false;
            referencedRelation: "moneda";
            referencedColumns: ["codigo"];
          },
          {
            foreignKeyName: "premio_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: false;
            referencedRelation: "temporada";
            referencedColumns: ["id"];
          },
        ];
      };
      premio_asignacion: {
        Row: {
          academia_id: string;
          asignado_at: string;
          asignado_por: string | null;
          evento_id: string;
          ficha_id: string;
          id: string;
          monto_centavos: number | null;
          nota: string | null;
          premio_id: string;
        };
        Insert: {
          academia_id: string;
          asignado_at?: string;
          asignado_por?: string | null;
          evento_id: string;
          ficha_id: string;
          id?: string;
          monto_centavos?: number | null;
          nota?: string | null;
          premio_id: string;
        };
        Update: {
          academia_id?: string;
          asignado_at?: string;
          asignado_por?: string | null;
          evento_id?: string;
          ficha_id?: string;
          id?: string;
          monto_centavos?: number | null;
          nota?: string | null;
          premio_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "premio_asignacion_ficha_id_evento_id_academia_id_fkey";
            columns: ["ficha_id","evento_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "ficha";
            referencedColumns: ["id","evento_id","academia_id"];
          },
          {
            foreignKeyName: "premio_asignacion_premio_id_fkey";
            columns: ["premio_id"];
            isOneToOne: false;
            referencedRelation: "premio";
            referencedColumns: ["id"];
          },
        ];
      };
      reglamento: {
        Row: {
          actualizado_at: string;
          config: Json;
          creado_at: string;
          creado_por: string | null;
          id: string;
          nombre: Json;
          preset: string | null;
          version: number;
        };
        Insert: {
          actualizado_at?: string;
          config: Json;
          creado_at?: string;
          creado_por?: string | null;
          id?: string;
          nombre: Json;
          preset?: string | null;
          version?: number;
        };
        Update: {
          actualizado_at?: string;
          config?: Json;
          creado_at?: string;
          creado_por?: string | null;
          id?: string;
          nombre?: Json;
          preset?: string | null;
          version?: number;
        };
        Relationships: [

        ];
      };
      reserva_clase: {
        Row: {
          academia_id: string | null;
          clase_id: string;
          cobrado_at: string | null;
          cobrado_por: string | null;
          creado_at: string;
          email: string | null;
          estado: string;
          evento_id: string;
          id: string;
          nombre: string;
          pagada: boolean;
        };
        Insert: {
          academia_id?: string | null;
          clase_id: string;
          cobrado_at?: string | null;
          cobrado_por?: string | null;
          creado_at?: string;
          email?: string | null;
          estado?: string;
          evento_id: string;
          id?: string;
          nombre: string;
          pagada?: boolean;
        };
        Update: {
          academia_id?: string | null;
          clase_id?: string;
          cobrado_at?: string | null;
          cobrado_por?: string | null;
          creado_at?: string;
          email?: string | null;
          estado?: string;
          evento_id?: string;
          id?: string;
          nombre?: string;
          pagada?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "reserva_clase_academia_id_fkey";
            columns: ["academia_id"];
            isOneToOne: false;
            referencedRelation: "academia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reserva_clase_clase_id_evento_id_fkey";
            columns: ["clase_id","evento_id"];
            isOneToOne: false;
            referencedRelation: "clase";
            referencedColumns: ["id","evento_id"];
          },
        ];
      };
      reserva_entrada: {
        Row: {
          cantidad: number;
          cobrado_at: string | null;
          cobrado_por: string | null;
          codigo: string;
          creado_at: string;
          email: string;
          entrada_tipo_id: string;
          estado: string;
          evento_id: string;
          id: string;
          nombre: string;
          pagada: boolean;
        };
        Insert: {
          cantidad: number;
          cobrado_at?: string | null;
          cobrado_por?: string | null;
          codigo?: string;
          creado_at?: string;
          email: string;
          entrada_tipo_id: string;
          estado?: string;
          evento_id: string;
          id?: string;
          nombre: string;
          pagada?: boolean;
        };
        Update: {
          cantidad?: number;
          cobrado_at?: string | null;
          cobrado_por?: string | null;
          codigo?: string;
          creado_at?: string;
          email?: string;
          entrada_tipo_id?: string;
          estado?: string;
          evento_id?: string;
          id?: string;
          nombre?: string;
          pagada?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "reserva_entrada_entrada_tipo_id_evento_id_fkey";
            columns: ["entrada_tipo_id","evento_id"];
            isOneToOne: false;
            referencedRelation: "entrada_tipo";
            referencedColumns: ["id","evento_id"];
          },
        ];
      };
      resultado: {
        Row: {
          academia_id: string;
          banda: string | null;
          calculado_at: string;
          calculado_por: string | null;
          evento_id: string;
          ficha_id: string;
          grupo: string;
          puesto: number;
          puntaje: number;
        };
        Insert: {
          academia_id: string;
          banda?: string | null;
          calculado_at?: string;
          calculado_por?: string | null;
          evento_id: string;
          ficha_id: string;
          grupo: string;
          puesto: number;
          puntaje: number;
        };
        Update: {
          academia_id?: string;
          banda?: string | null;
          calculado_at?: string;
          calculado_por?: string | null;
          evento_id?: string;
          ficha_id?: string;
          grupo?: string;
          puesto?: number;
          puntaje?: number;
        };
        Relationships: [
          {
            foreignKeyName: "resultado_ficha_id_evento_id_academia_id_fkey";
            columns: ["ficha_id","evento_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "ficha";
            referencedColumns: ["id","evento_id","academia_id"];
          },
        ];
      };
      rol: {
        Row: {
          codigo: string;
          nombre: Json;
          orden: number;
          sistema: boolean;
        };
        Insert: {
          codigo: string;
          nombre: Json;
          orden?: number;
          sistema?: boolean;
        };
        Update: {
          codigo?: string;
          nombre?: Json;
          orden?: number;
          sistema?: boolean;
        };
        Relationships: [

        ];
      };
      rol_global: {
        Row: {
          otorgado_at: string;
          otorgado_por: string | null;
          rol: string;
          usuario_id: string;
        };
        Insert: {
          otorgado_at?: string;
          otorgado_por?: string | null;
          rol: string;
          usuario_id: string;
        };
        Update: {
          otorgado_at?: string;
          otorgado_por?: string | null;
          rol?: string;
          usuario_id?: string;
        };
        Relationships: [

        ];
      };
      rol_permiso: {
        Row: {
          permiso: string;
          rol: string;
        };
        Insert: {
          permiso: string;
          rol: string;
        };
        Update: {
          permiso?: string;
          rol?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rol_permiso_permiso_fkey";
            columns: ["permiso"];
            isOneToOne: false;
            referencedRelation: "permiso";
            referencedColumns: ["codigo"];
          },
          {
            foreignKeyName: "rol_permiso_rol_fkey";
            columns: ["rol"];
            isOneToOne: false;
            referencedRelation: "rol";
            referencedColumns: ["codigo"];
          },
        ];
      };
      solicitud_modificacion: {
        Row: {
          academia_id: string;
          creado_at: string;
          creado_por: string | null;
          descripcion: string;
          estado: string;
          evento_id: string;
          ficha_id: string;
          id: string;
          respuesta: string | null;
          resuelto_at: string | null;
          resuelto_por: string | null;
        };
        Insert: {
          academia_id: string;
          creado_at?: string;
          creado_por?: string | null;
          descripcion: string;
          estado?: string;
          evento_id: string;
          ficha_id: string;
          id?: string;
          respuesta?: string | null;
          resuelto_at?: string | null;
          resuelto_por?: string | null;
        };
        Update: {
          academia_id?: string;
          creado_at?: string;
          creado_por?: string | null;
          descripcion?: string;
          estado?: string;
          evento_id?: string;
          ficha_id?: string;
          id?: string;
          respuesta?: string | null;
          resuelto_at?: string | null;
          resuelto_por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "solicitud_modificacion_ficha_id_evento_id_academia_id_fkey";
            columns: ["ficha_id","evento_id","academia_id"];
            isOneToOne: false;
            referencedRelation: "ficha";
            referencedColumns: ["id","evento_id","academia_id"];
          },
        ];
      };
      temporada: {
        Row: {
          actualizado_at: string;
          anio: number;
          creado_at: string;
          id: string;
          nombre: Json;
          publicada: boolean;
          reglamento_id: string | null;
        };
        Insert: {
          actualizado_at?: string;
          anio: number;
          creado_at?: string;
          id?: string;
          nombre: Json;
          publicada?: boolean;
          reglamento_id?: string | null;
        };
        Update: {
          actualizado_at?: string;
          anio?: number;
          creado_at?: string;
          id?: string;
          nombre?: Json;
          publicada?: boolean;
          reglamento_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "temporada_reglamento_id_fkey";
            columns: ["reglamento_id"];
            isOneToOne: false;
            referencedRelation: "reglamento";
            referencedColumns: ["id"];
          },
        ];
      };
      turno_caja: {
        Row: {
          abierto_at: string;
          cerrado_at: string | null;
          cerrado_por: string | null;
          evento_id: string;
          id: string;
          resumen: Json | null;
          usuario_id: string;
        };
        Insert: {
          abierto_at?: string;
          cerrado_at?: string | null;
          cerrado_por?: string | null;
          evento_id: string;
          id?: string;
          resumen?: Json | null;
          usuario_id: string;
        };
        Update: {
          abierto_at?: string;
          cerrado_at?: string | null;
          cerrado_por?: string | null;
          evento_id?: string;
          id?: string;
          resumen?: Json | null;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "turno_caja_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "evento";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_devolucion_jurado: {
        Row: {
          academia_id: string | null;
          comentario: string | null;
          evento_id: string | null;
          ficha_id: string | null;
          jurado_numero: number | null;
          notas: Json | null;
          total: number | null;
        };
        Relationships: [];
      };
      v_liquidacion_estado: {
        Row: {
          academia_id: string | null;
          cobrado_centavos: number | null;
          emitida_at: string | null;
          estado: string | null;
          evento_id: string | null;
          inscripcion_id: string | null;
          liquidacion_id: string | null;
          moneda: string | null;
          numero: string | null;
          primer_pago_at: string | null;
          qr_token: string | null;
          saldo_centavos: number | null;
          total_centavos: number | null;
          version: number | null;
        };
        Relationships: [];
      };
      v_resumen_cobranza: {
        Row: {
          cobrado_centavos: number | null;
          esperado_centavos: number | null;
          evento_id: string | null;
          liquidaciones: number | null;
          moneda: string | null;
          pagadas: number | null;
          parciales: number | null;
          pendiente_centavos: number | null;
          pendientes: number | null;
          sin_cargo: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      crear_liquidacion: {
        Args: {
          p_inscripcion: string;
        };
        Returns: Database['public']['Tables']["liquidacion"]['Row'];
      };
      eventos_destino_pase: {
        Args: {
          p_origen: string;
        };
        Returns: {
            id: string;
            slug: string;
            nombre: Json;
            tipo: string;
            fecha_inicio: string;
          }[];
      };
      publico_orden: {
        Args: {
          p_slug: string;
        };
        Returns: {
            pista: Json;
            bloque: Json;
            inicio_programado: string;
            posicion: number;
            estado: string;
            coreografia: string;
            academia: string;
            ciudad: string;
            categoria: string;
            formacion: string;
            genero: string;
          }[];
      };
      publico_resultados: {
        Args: {
          p_slug: string;
        };
        Returns: {
            grupo: string;
            puesto: number;
            puntaje: number;
            banda: string;
            coreografia: string;
            academia: string;
            ciudad: string;
            categoria: string;
            formacion: string;
            genero: string;
          }[];
      };
      reordenar_orden: {
        Args: {
          p_item: string;
          p_bloque_destino: string;
          p_posicion: number;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type Publico = Database['public'];
export type Tabla<T extends keyof Publico['Tables']> = Publico['Tables'][T]['Row'];
export type TablaInsert<T extends keyof Publico['Tables']> = Publico['Tables'][T]['Insert'];
export type TablaUpdate<T extends keyof Publico['Tables']> = Publico['Tables'][T]['Update'];
export type Vista<T extends keyof Publico['Views']> = Publico['Views'][T]['Row'];
