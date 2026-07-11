import { Aula, CursoDetalhado } from "@/services/averon";

let _lesson: Aula | null = null;
let _curso: CursoDetalhado | null = null;

export function setLesson(aula: Aula, curso?: CursoDetalhado): void {
  _lesson = aula;
  if (curso !== undefined) _curso = curso;
}

export function getLesson(id: string): Aula | null {
  if (_lesson?.id === id) return _lesson;
  return null;
}

export function getCursoCache(): CursoDetalhado | null {
  return _curso;
}
