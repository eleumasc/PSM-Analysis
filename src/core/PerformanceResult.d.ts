export interface MeasurePerformanceResult {
  standardLoadTimes: number[];
  analysisLoadTimes: number[];
}

export interface PerformanceResult {
  completion: Completion<MeasurePerformanceResult>;
}
