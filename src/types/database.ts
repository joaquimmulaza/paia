
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "academic_info": {
                  Row: {
                    "class_group": string,"class_option_id": string | null,"course": string,"course_option_id": string | null,"curricular_year": string,"curricular_year_option_id": string | null,"shift": string,"shift_option_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_group": string,"class_option_id"?: string | null,"course": string,"course_option_id"?: string | null,"curricular_year": string,"curricular_year_option_id"?: string | null,"shift": string,"shift_option_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "class_group"?: string,"class_option_id"?: string | null,"course"?: string,"course_option_id"?: string | null,"curricular_year"?: string,"curricular_year_option_id"?: string | null,"shift"?: string,"shift_option_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "academic_info_class_option_id_fkey"
      columns: ["class_option_id"]
isOneToOne: false
      referencedRelation: "academic_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "academic_info_course_option_id_fkey"
      columns: ["course_option_id"]
isOneToOne: false
      referencedRelation: "academic_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "academic_info_curricular_year_option_id_fkey"
      columns: ["curricular_year_option_id"]
isOneToOne: false
      referencedRelation: "academic_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "academic_info_shift_option_id_fkey"
      columns: ["shift_option_id"]
isOneToOne: false
      referencedRelation: "academic_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "academic_info_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"academic_options": {
                  Row: {
                    "id": string,"is_active": boolean,"kind": Database["public"]['Enums']["academic_option_kind"],"label": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_active"?: boolean,"kind": Database["public"]['Enums']["academic_option_kind"],"label": string,"position"?: number
                  }
                  Update: {
                    "id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["academic_option_kind"],"label"?: string,"position"?: number
                  }
                  Relationships: [
                    
                  ]
                },"admin_users": {
                  Row: {
                    "created_at": string,"created_by": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "affiliation": Database["public"]['Enums']["affiliation"],"created_at": string,"full_name": string,"id": string,"phone": string,"terms_accepted_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliation": Database["public"]['Enums']["affiliation"],"created_at"?: string,"full_name": string,"id": string,"phone": string,"terms_accepted_at": string,"updated_at"?: string
                  }
                  Update: {
                    "affiliation"?: Database["public"]['Enums']["affiliation"],"created_at"?: string,"full_name"?: string,"id"?: string,"phone"?: string,"terms_accepted_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "get_my_profile":
{ Args: Record<PropertyKey, never>; Returns: {
              "affiliation": Database["public"]['Enums']["affiliation"],"class_group": string,"course": string,"curricular_year": string,"full_name": string,"is_admin": boolean,"phone": string,"shift": string
            }[]
                           }
          }
          Enums: {
            "academic_option_kind": "course"|"curricular_year"|"shift"|"class_group","affiliation": "student"|"teacher"|"staff"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "academic_option_kind": ["course", "curricular_year", "shift", "class_group"],"affiliation": ["student", "teacher", "staff"]
          }
        }
} as const
