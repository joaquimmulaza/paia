
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
                    "affiliation": Database["public"]['Enums']["affiliation"],"class_group": string,"class_option_id": string | null,"course": string,"course_option_id": string | null,"created_at": string,"curricular_year": string,"curricular_year_option_id": string | null,"shift": string,"shift_option_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliation"?: Database["public"]['Enums']["affiliation"],"class_group": string,"class_option_id"?: string | null,"course": string,"course_option_id"?: string | null,"created_at"?: string,"curricular_year": string,"curricular_year_option_id"?: string | null,"shift": string,"shift_option_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "affiliation"?: Database["public"]['Enums']["affiliation"],"class_group"?: string,"class_option_id"?: string | null,"course"?: string,"course_option_id"?: string | null,"created_at"?: string,"curricular_year"?: string,"curricular_year_option_id"?: string | null,"shift"?: string,"shift_option_id"?: string | null,"updated_at"?: string,"user_id"?: string
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
      foreignKeyName: "academic_info_user_id_affiliation_fkey"
      columns: ["user_id","affiliation"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","affiliation"]
    }
                  ]
                },"academic_options": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["academic_option_kind"],"label": string,"position": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"kind": Database["public"]['Enums']["academic_option_kind"],"label": string,"position"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["academic_option_kind"],"label"?: string,"position"?: number,"updated_at"?: string
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
                },"categories": {
                  Row: {
                    "created_at": string,"id": string,"is_visible": boolean,"name": string,"position": number,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_visible"?: boolean,"name": string,"position"?: number,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_visible"?: boolean,"name"?: string,"position"?: number,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_images": {
                  Row: {
                    "id": string,"path": string,"position": number,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"path": string,"position": number,"product_id": string
                  }
                  Update: {
                    "id"?: string,"path"?: string,"position"?: number,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "category_id": string,"created_at": string,"description": string,"id": string,"is_published": boolean,"moderation_reason": string | null,"moderation_status": Database["public"]['Enums']["moderation_status"],"name": string,"price_kz": number,"stock": number,"store_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"created_at"?: string,"description"?: string,"id"?: string,"is_published"?: boolean,"moderation_reason"?: string | null,"moderation_status"?: Database["public"]['Enums']["moderation_status"],"name": string,"price_kz": number,"stock": number,"store_id": string,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string,"created_at"?: string,"description"?: string,"id"?: string,"is_published"?: boolean,"moderation_reason"?: string | null,"moderation_status"?: Database["public"]['Enums']["moderation_status"],"name"?: string,"price_kz"?: number,"stock"?: number,"store_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
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
                },"store_decisions": {
                  Row: {
                    "admin_id": string,"checklist": NonNullable<Json>,"created_at": string,"decision": Database["public"]['Enums']["store_decision"],"id": number,"message": string | null,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_id": string,"checklist"?: NonNullable<Json>,"created_at"?: string,"decision": Database["public"]['Enums']["store_decision"],"id"?: never,"message"?: string | null,"store_id": string
                  }
                  Update: {
                    "admin_id"?: string,"checklist"?: NonNullable<Json>,"created_at"?: string,"decision"?: Database["public"]['Enums']["store_decision"],"id"?: never,"message"?: string | null,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_decisions_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"store_features": {
                  Row: {
                    "created_at": string,"created_by": string | null,"ends_at": string | null,"id": string,"is_active": boolean,"note": string | null,"position": number,"source": Database["public"]['Enums']["feature_source"],"starts_at": string | null,"store_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"is_active"?: boolean,"note"?: string | null,"position"?: number,"source"?: Database["public"]['Enums']["feature_source"],"starts_at"?: string | null,"store_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"is_active"?: boolean,"note"?: string | null,"position"?: number,"source"?: Database["public"]['Enums']["feature_source"],"starts_at"?: string | null,"store_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_features_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"stores": {
                  Row: {
                    "category_id": string,"cover_path": string | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"description": string,"id": string,"logo_path": string | null,"name": string,"owner_id": string,"published_products_count": number,"rating_avg": number | null,"rating_count": number,"slug": string,"status": Database["public"]['Enums']["store_status"],"submitted_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"cover_path"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"description"?: string,"id"?: string,"logo_path"?: string | null,"name": string,"owner_id": string,"published_products_count"?: number,"rating_avg"?: number | null,"rating_count"?: number,"slug": string,"status"?: Database["public"]['Enums']["store_status"],"submitted_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string,"cover_path"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"description"?: string,"id"?: string,"logo_path"?: string | null,"name"?: string,"owner_id"?: string,"published_products_count"?: number,"rating_avg"?: number | null,"rating_count"?: number,"slug"?: string,"status"?: Database["public"]['Enums']["store_status"],"submitted_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stores_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stores_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_count_pending_stores":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"admin_decide_store":
{ Args: { "p_checklist": Json,"p_decision": Database["public"]['Enums']["store_decision"],"p_message": string,"p_store_id": string }; Returns: Database["public"]['Enums']["store_status"]
                           },
"admin_get_store_application":
{ Args: { "p_store_id": string }; Returns: {
              "category_name": string,"cover_path": string,"description": string,"id": string,"logo_path": string,"name": string,"owner_affiliation": Database["public"]['Enums']["affiliation"],"owner_created_at": string,"owner_name": string,"slug": string,"status": Database["public"]['Enums']["store_status"],"submitted_at": string
            }[]
                           },
"admin_list_store_applications":
{ Args: { "p_cursor_at"?: string,"p_cursor_id"?: string,"p_limit"?: number,"p_status": Database["public"]['Enums']["store_status"] }; Returns: {
              "category_name": string,"decided_at": string,"id": string,"logo_path": string,"name": string,"owner_affiliation": Database["public"]['Enums']["affiliation"],"owner_name": string,"slug": string,"submitted_at": string
            }[]
                           },
"admin_list_store_decisions":
{ Args: { "p_store_id": string }; Returns: {
              "admin_name": string,"checklist": Json,"created_at": string,"decision": Database["public"]['Enums']["store_decision"],"message": string
            }[]
                           },
"admin_list_store_features":
{ Args: Record<PropertyKey, never>; Returns: {
              "ends_at": string,"id": string,"is_active": boolean,"is_live": boolean,"note": string,"position": number,"source": Database["public"]['Enums']["feature_source"],"starts_at": string,"store_id": string,"store_name": string,"store_slug": string,"store_status": Database["public"]['Enums']["store_status"]
            }[]
                           },
"admin_remove_store_feature":
{ Args: { "p_id": string }; Returns: undefined
                           },
"admin_reorder_store_features":
{ Args: { "p_ids": (string)[] }; Returns: undefined
                           },
"admin_save_store_feature":
{ Args: { "p_ends_at": string,"p_id": string,"p_note": string,"p_position": number,"p_starts_at": string,"p_store_id": string }; Returns: string
                           },
"admin_set_store_feature_active":
{ Args: { "p_active": boolean,"p_id": string }; Returns: undefined
                           },
"get_my_profile":
{ Args: Record<PropertyKey, never>; Returns: {
              "affiliation": Database["public"]['Enums']["affiliation"],"class_group": string,"course": string,"curricular_year": string,"full_name": string,"is_admin": boolean,"phone": string,"shift": string
            }[]
                           },
"get_my_store":
{ Args: Record<PropertyKey, never>; Returns: {
              "category_id": string,"cover_path": string,"created_at": string,"decided_at": string,"description": string,"hidden_products_count": number,"id": string,"last_message": string,"logo_path": string,"name": string,"published_products_count": number,"slug": string,"sold_out_products_count": number,"status": Database["public"]['Enums']["store_status"],"submitted_at": string
            }[]
                           },
"get_my_store_decisions":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"decision": Database["public"]['Enums']["store_decision"],"message": string
            }[]
                           },
"get_product":
{ Args: { "p_id": string }; Returns: {
              "category_name": string,"category_slug": string,"created_at": string,"description": string,"id": string,"images": Json,"name": string,"price_kz": number,"stock": number,"store_name": string,"store_rating_avg": number,"store_rating_count": number,"store_slug": string
            }[]
                           },
"get_store":
{ Args: { "p_slug": string }; Returns: {
              "category_name": string,"category_slug": string,"description": string,"id": string,"logo_path": string,"name": string,"product_categories": Json,"published_products_count": number,"rating_avg": number,"rating_count": number,"slug": string
            }[]
                           },
"list_featured_stores":
{ Args: Record<PropertyKey, never>; Returns: {
              "category_name": string,"category_slug": string,"description": string,"id": string,"logo_path": string,"name": string,"published_products_count": number,"rating_avg": number,"rating_count": number,"slug": string,"source": Database["public"]['Enums']["feature_source"]
            }[]
                           },
"list_stores":
{ Args: { "p_category_slug"?: string,"p_q"?: string }; Returns: {
              "category_name": string,"category_slug": string,"description": string,"id": string,"logo_path": string,"name": string,"published_products_count": number,"rating_avg": number,"rating_count": number,"slug": string
            }[]
                           },
"save_my_store":
{ Args: { "p_category_id": string,"p_cover_path": string,"p_description": string,"p_logo_path": string,"p_name": string }; Returns: string
                           },
"search_key":
{ Args: { "p": string }; Returns: string
                           },
"search_products":
{ Args: { "p_after_created_at"?: string,"p_after_id"?: string,"p_after_price"?: number,"p_category_slug"?: string,"p_limit"?: number,"p_q"?: string,"p_sort"?: string,"p_store_slug"?: string }; Returns: {
              "category_slug": string,"created_at": string,"id": string,"main_image_path": string,"name": string,"price_kz": number,"stock": number,"store_name": string,"store_slug": string
            }[]
                           },
"submit_my_store":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["store_status"]
                           }
          }
          Enums: {
            "academic_option_kind": "course"|"curricular_year"|"shift"|"class_group","affiliation": "student"|"teacher"|"staff","feature_source": "admin"|"paid","moderation_status": "visible"|"hidden","store_decision": "approved"|"rejected"|"suspended"|"reactivated","store_status": "draft"|"pending_approval"|"approved"|"rejected"|"suspended"
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
            "academic_option_kind": ["course", "curricular_year", "shift", "class_group"],"affiliation": ["student", "teacher", "staff"],"feature_source": ["admin", "paid"],"moderation_status": ["visible", "hidden"],"store_decision": ["approved", "rejected", "suspended", "reactivated"],"store_status": ["draft", "pending_approval", "approved", "rejected", "suspended"]
          }
        }
} as const
