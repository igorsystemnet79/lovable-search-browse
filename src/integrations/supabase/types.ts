export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      apr_firme: {
        Row: {
          adresa: string | null
          maticni_broj: string | null
          naziv: string
          pib: string
          sediste: string | null
          status: string | null
          synced_at: string
        }
        Insert: {
          adresa?: string | null
          maticni_broj?: string | null
          naziv: string
          pib: string
          sediste?: string | null
          status?: string | null
          synced_at?: string
        }
        Update: {
          adresa?: string | null
          maticni_broj?: string | null
          naziv?: string
          pib?: string
          sediste?: string | null
          status?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      apr_sinhronizacije: {
        Row: {
          broj_firmi: number
          created_at: string
          id: string
          pokrenuo: string | null
          poruka: string | null
          uspeh: boolean
        }
        Insert: {
          broj_firmi?: number
          created_at?: string
          id?: string
          pokrenuo?: string | null
          poruka?: string | null
          uspeh?: boolean
        }
        Update: {
          broj_firmi?: number
          created_at?: string
          id?: string
          pokrenuo?: string | null
          poruka?: string | null
          uspeh?: boolean
        }
        Relationships: []
      }
      izmene_oglasa: {
        Row: {
          created_at: string
          id: string
          oglas_id: string
          opis: string
          tabela: string
        }
        Insert: {
          created_at?: string
          id?: string
          oglas_id: string
          opis: string
          tabela: string
        }
        Update: {
          created_at?: string
          id?: string
          oglas_id?: string
          opis?: string
          tabela?: string
        }
        Relationships: []
      }
      ponude: {
        Row: {
          cena: number | null
          created_at: string
          emoji: string | null
          id: string
          istaknuto: boolean
          kategorija: string
          kontakt_ime: string | null
          lokacija: string
          naslov: string
          opis: string | null
          telefon: string | null
          updated_at: string | null
          user_id: string | null
          valuta: string
          zavrseno: boolean
        }
        Insert: {
          cena?: number | null
          created_at?: string
          emoji?: string | null
          id?: string
          istaknuto?: boolean
          kategorija: string
          kontakt_ime?: string | null
          lokacija: string
          naslov: string
          opis?: string | null
          telefon?: string | null
          updated_at?: string | null
          user_id?: string | null
          valuta?: string
          zavrseno?: boolean
        }
        Update: {
          cena?: number | null
          created_at?: string
          emoji?: string | null
          id?: string
          istaknuto?: boolean
          kategorija?: string
          kontakt_ime?: string | null
          lokacija?: string
          naslov?: string
          opis?: string | null
          telefon?: string | null
          updated_at?: string | null
          user_id?: string | null
          valuta?: string
          zavrseno?: boolean
        }
        Relationships: []
      }
      poruke_podrske: {
        Row: {
          created_at: string
          email: string
          id: string
          ime: string
          poruka: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ime: string
          poruka: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ime?: string
          poruka?: string
        }
        Relationships: []
      }
      pracenja: {
        Row: {
          created_at: string
          id: string
          pocetna_cena: number | null
          ponuda_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pocetna_cena?: number | null
          ponuda_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pocetna_cena?: number | null
          ponuda_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pracenja_ponuda_id_fkey"
            columns: ["ponuda_id"]
            isOneToOne: false
            referencedRelation: "ponude"
            referencedColumns: ["id"]
          },
        ]
      }
      slike_oglasa: {
        Row: { id: string; ponuda_id: string | null; zahtev_id: string | null; storage_path: string | null; external_url: string | null; pozicija: number; created_at: string }
        Insert: { id?: string; ponuda_id?: string | null; zahtev_id?: string | null; storage_path?: string | null; external_url?: string | null; pozicija?: number; created_at?: string }
        Update: { id?: string; ponuda_id?: string | null; zahtev_id?: string | null; storage_path?: string | null; external_url?: string | null; pozicija?: number; created_at?: string }
        Relationships: []
      }
      profiles: {
        Row: {
          adresa: string | null
          blokiran: boolean
          created_at: string
          email: string | null
          firma_verifikovana: boolean
          grad: string | null
          id: string
          ime: string | null
          naziv_firme: string | null
          pib: string | null
          telefon: string | null
          tip_lica: string
        }
        Insert: {
          adresa?: string | null
          blokiran?: boolean
          created_at?: string
          email?: string | null
          firma_verifikovana?: boolean
          grad?: string | null
          id: string
          ime?: string | null
          naziv_firme?: string | null
          pib?: string | null
          telefon?: string | null
          tip_lica?: string
        }
        Update: {
          adresa?: string | null
          blokiran?: boolean
          created_at?: string
          email?: string | null
          firma_verifikovana?: boolean
          grad?: string | null
          id?: string
          ime?: string | null
          naziv_firme?: string | null
          pib?: string | null
          telefon?: string | null
          tip_lica?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      zahtevi: {
        Row: {
          budzet: number | null
          created_at: string
          id: string
          kategorija: string
          kontakt_ime: string | null
          lokacija: string
          naslov: string
          opis: string | null
          telefon: string | null
          updated_at: string | null
          user_id: string | null
          valuta: string
          zavrseno: boolean
        }
        Insert: {
          budzet?: number | null
          created_at?: string
          id?: string
          kategorija: string
          kontakt_ime?: string | null
          lokacija: string
          naslov: string
          opis?: string | null
          telefon?: string | null
          updated_at?: string | null
          user_id?: string | null
          valuta?: string
          zavrseno?: boolean
        }
        Update: {
          budzet?: number | null
          created_at?: string
          id?: string
          kategorija?: string
          kontakt_ime?: string | null
          lokacija?: string
          naslov?: string
          opis?: string | null
          telefon?: string | null
          updated_at?: string | null
          user_id?: string | null
          valuta?: string
          zavrseno?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_blocked: { Args: { _user_id: string }; Returns: boolean }
      koren_reci: { Args: { w: string }; Returns: string }
      normalizuj: { Args: { t: string }; Returns: string }
      pretraga_uslov: { Args: { q: string; tekst: string }; Returns: boolean }
      pretrazi_ponude: {
        Args: { mesto: string; q: string }
        Returns: {
          cena: number | null
          created_at: string
          emoji: string | null
          id: string
          istaknuto: boolean
          kategorija: string
          kontakt_ime: string | null
          lokacija: string
          naslov: string
          opis: string | null
          telefon: string | null
          updated_at: string | null
          user_id: string | null
          valuta: string
          zavrseno: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "ponude"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      pretrazi_zahteve: {
        Args: { mesto: string; q: string }
        Returns: {
          budzet: number | null
          created_at: string
          id: string
          kategorija: string
          kontakt_ime: string | null
          lokacija: string
          naslov: string
          opis: string | null
          telefon: string | null
          updated_at: string | null
          user_id: string | null
          valuta: string
          zavrseno: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "zahtevi"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
