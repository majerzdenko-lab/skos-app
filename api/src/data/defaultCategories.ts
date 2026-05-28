import { CategoryType } from '@prisma/client';

export const defaultCategories = [
  { name: 'Deti do 16 rokov Profi', plotDimensions: '5×1,5 m', plotCount: 23, categoryType: 'INDIVIDUAL' as CategoryType, scored: true },
  { name: 'Ženy Profi', plotDimensions: '10×1,8 m', plotCount: 23, categoryType: 'INDIVIDUAL' as CategoryType, scored: true },
  { name: 'Muži od 16 do 60 rokov Profi', plotDimensions: '10×1,8 m', plotCount: 23, categoryType: 'INDIVIDUAL' as CategoryType, scored: true },
  { name: 'Muži nad 60 rokov Profi', plotDimensions: '10×1,8 m', plotCount: 23, categoryType: 'INDIVIDUAL' as CategoryType, scored: true },
  { name: 'Deti Hobby', plotDimensions: '5×1 m', plotCount: 23, categoryType: 'INDIVIDUAL' as CategoryType, scored: true },
  { name: 'Ženy Hobby', plotDimensions: '5×1,5 m', plotCount: 23, categoryType: 'INDIVIDUAL' as CategoryType, scored: true },
  { name: 'Muži do 60 rokov Hobby', plotDimensions: '10×1,8 m', plotCount: 23, categoryType: 'INDIVIDUAL' as CategoryType, scored: true },
  { name: 'Muži nad 60 rokov Hobby', plotDimensions: '10×1,5 m', plotCount: 23, categoryType: 'INDIVIDUAL' as CategoryType, scored: true },
  { name: 'Družstvá', plotDimensions: '10×10 m', plotCount: 10, categoryType: 'TEAM' as CategoryType, scored: true },
];
