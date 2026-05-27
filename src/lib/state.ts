export type SectionSnapshot = {
  container: Element;
  end: Element | null;
  items: Element[];
};

export type PageState = {
  url: string;
  scanInProgress: boolean;
  scanCompleted: boolean;
  selectionMode: boolean;
  sortedMode: boolean;
  originalOrder: SectionSnapshot[] | null;
  observer: MutationObserver | null;
};

export const pageState: PageState = {
  url: '',
  scanInProgress: false,
  scanCompleted: false,
  selectionMode: false,
  sortedMode: false,
  originalOrder: null,
  observer: null,
};

export const resetPageState = (): void => {
  if (pageState.observer) pageState.observer.disconnect();
  pageState.url = typeof location !== 'undefined' ? location.href : '';
  pageState.scanInProgress = false;
  pageState.scanCompleted = false;
  pageState.selectionMode = false;
  pageState.sortedMode = false;
  pageState.originalOrder = null;
  pageState.observer = null;
};
