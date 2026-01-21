export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string
                    username: string
                    avatar_type: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id: string
                    username: string
                    avatar_type?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    username?: string
                    avatar_type?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            products: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    price: number
                    category: string
                    image_url: string | null
                    position_x: number
                    position_y: number
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    price: number
                    category: string
                    image_url?: string | null
                    position_x: number
                    position_y: number
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    price?: number
                    category?: string
                    image_url?: string | null
                    position_x?: number
                    position_y?: number
                    created_at?: string | null
                }
            }
            cart_items: {
                Row: {
                    id: string
                    user_id: string
                    product_id: string
                    quantity: number
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    product_id: string
                    quantity?: number
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    product_id?: string
                    quantity?: number
                    created_at?: string | null
                }
            }
            orders: {
                Row: {
                    id: string
                    user_id: string
                    total: number
                    status: string | null
                    items: Json
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    total: number
                    status?: string | null
                    items: Json
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    total?: number
                    status?: string | null
                    items?: Json
                    created_at?: string | null
                }
            }
            chat_messages: {
                Row: {
                    id: string
                    user_id: string
                    username: string
                    message: string
                    position_x: number | null
                    position_y: number | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    username: string
                    message: string
                    position_x?: number | null
                    position_y?: number | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    username?: string
                    message?: string
                    position_x?: number | null
                    position_y?: number | null
                    created_at?: string | null
                }
            }
            user_presence: {
                Row: {
                    user_id: string
                    username: string
                    position_x: number
                    position_y: number
                    direction: string | null
                    is_moving: boolean | null
                    last_seen: string | null
                }
                Insert: {
                    user_id: string
                    username: string
                    position_x?: number
                    position_y?: number
                    direction?: string | null
                    is_moving?: boolean | null
                    last_seen?: string | null
                }
                Update: {
                    user_id?: string
                    username?: string
                    position_x?: number
                    position_y?: number
                    direction?: string | null
                    is_moving?: boolean | null
                    last_seen?: string | null
                }
            }
            user_activity: {
                Row: {
                    id: string
                    user_id: string
                    product_id: string | null
                    action_type: string
                    duration: number | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    product_id?: string | null
                    action_type: string
                    duration?: number | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    product_id?: string | null
                    action_type?: string
                    duration?: number | null
                    created_at?: string | null
                }
            }
            presence: {
                Row: {
                    user_id: string
                    username: string | null
                    position: Json | null
                    avatar_customization: Json | null
                    last_seen: string | null
                }
                Insert: {
                    user_id: string
                    username?: string | null
                    position?: Json | null
                    avatar_customization?: Json | null
                    last_seen?: string | null
                }
                Update: {
                    user_id?: string
                    username?: string | null
                    position?: Json | null
                    avatar_customization?: Json | null
                    last_seen?: string | null
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
