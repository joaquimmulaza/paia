import type { MyProfile } from '@/features/auth/api';
import type { MyStore } from '@/features/seller/types';

export const CATEGORIES = [
  { id: 'cat-doces', name: 'Doces', slug: 'doces' },
  { id: 'cat-salgados', name: 'Salgados', slug: 'salgados' },
];

export function makeStore(overrides: Partial<MyStore> = {}): MyStore {
  return {
    id: 'store-1',
    name: 'Doces da Ana',
    slug: 'doces-da-ana',
    description: 'Bolos por fatia e encomendas para aniversários.',
    categoryId: 'cat-doces',
    logoPath: null,
    coverPath: null,
    status: 'draft',
    kind: 'draft',
    submittedAt: null,
    decidedAt: null,
    createdAt: '2026-11-27T20:40:00.000000+00:00',
    publishedProductsCount: 0,
    hiddenProductsCount: 0,
    soldOutProductsCount: 0,
    lastMessage: null,
    ...overrides,
  };
}

export const student: MyProfile = {
  fullName: 'Ana Exemplo',
  phone: '900000001',
  affiliation: 'student',
  course: 'Curso de exemplo',
  curricularYear: '2.º ano',
  shift: 'Manhã',
  classGroup: 'A',
  isAdmin: false,
};

export const teacher: MyProfile = {
  ...student,
  affiliation: 'teacher',
  course: null,
  curricularYear: null,
  shift: null,
  classGroup: null,
};
