import { describe, expect, it } from 'vitest';
import { t } from '@/i18n';

describe('t', () => {
  it('interpolates named placeholders into a template', () => {
    expect(
      t('en', (dictionary) => dictionary.traceGraph.disclosure.nodesVsCap, {
        returned: 4,
        cap: 500,
      }),
    ).toBe('4 of 500 cap');
    expect(
      t('km', (dictionary) => dictionary.traceGraph.disclosure.transfersLoaded, {
        loaded: '1,200',
        reported: '2,400',
      }),
    ).toBe('1,200 នៃ 2,400 ការផ្ទេរ');
  });

  it('renders a visible sentinel for a missing param, never a throw', () => {
    expect(
      t('en', (dictionary) => dictionary.traceGraph.disclosure.transfersLoaded, {
        loaded: 3,
      }),
    ).toBe('3 of {reported?} transfers');
  });

  it('renders every placeholder as a sentinel when a template is called without params', () => {
    expect(
      t(
        'en',
        (dictionary) => dictionary.traceGraph.disclosure.reasons.node_cap_reached,
      ),
    ).toBe(
      'Node cap of {nodeCap?} reached: {nodesKept?} of {nodesScoped?} nodes kept, highest value first.',
    );
  });

  it('leaves a template without placeholders untouched', () => {
    expect(t('en', (dictionary) => dictionary.common.save)).toBe('Save');
    expect(t('km', (dictionary) => dictionary.common.save)).toBe('រក្សាទុក');
  });
});
