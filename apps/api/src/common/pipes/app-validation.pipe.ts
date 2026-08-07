import { ValidationPipe, type ArgumentMetadata, type ValidationPipeOptions } from '@nestjs/common';

/**
 * A payload shape that tolerates properties the API has not learned about yet.
 *
 * The application-wide rule is the opposite: an unrecognised property is a 400.
 * That is right almost everywhere, because it turns a typo into an error
 * message instead of a setting that is silently ignored.
 *
 * It is wrong for the two kinds of caller that cannot hear the complaint:
 *
 *  - The analytics tracker, which discards every response by design, since a
 *    visitor must never see a measurement failure. When the site began sending
 *    one field its DTO did not list, every page view became a 400 that nothing
 *    reported, and measurement stopped dead while the panel showed a plausible
 *    zero.
 *  - The public contact form, whose other side is a static site deployed
 *    separately, so the two versions are routinely out of step. Rejecting a
 *    whole submission over an unknown field loses a real customer's enquiry to
 *    show them a validation error they did not cause.
 *
 * A DTO opts in by declaring `static readonly lenientValidation = true`. Every
 * field it does declare is validated exactly as strictly as anywhere else —
 * this only decides what happens to fields it does not.
 *
 * The marker is static because the pipe only ever sees the class, never an
 * instance; `implements` would check the wrong side of it.
 */
export interface LenientPayloadClass {
  readonly lenientValidation?: true;
}

function isLenient(metatype: ArgumentMetadata['metatype']): boolean {
  return (
    typeof metatype === 'function' &&
    (metatype as unknown as LenientPayloadClass).lenientValidation === true
  );
}

/**
 * The global pipe.
 *
 * A route-level `@UsePipes` cannot express this: Nest runs global pipes *as
 * well as* route-level ones, so a lenient pipe on the handler never sees a
 * request the strict global pipe has already rejected. The decision has to be
 * made by the pipe that runs first, and the only thing it knows about the
 * request is the DTO class — which is exactly the right place for a payload to
 * declare how it wants to be read.
 */
export class AppValidationPipe extends ValidationPipe {
  private readonly lenient: ValidationPipe;

  constructor(options: ValidationPipeOptions) {
    super(options);
    this.lenient = new ValidationPipe({
      ...options,
      whitelist: true,
      forbidNonWhitelisted: false,
    });
  }

  override async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    return isLenient(metadata.metatype)
      ? this.lenient.transform(value, metadata)
      : super.transform(value, metadata);
  }
}
